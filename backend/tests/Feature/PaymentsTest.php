<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Models\Appointment;
use App\Models\Payment;
use App\Notifications\AppointmentNotification;
use App\Services\Payments\MoyasarGateway;
use App\Services\Payments\PaymentGateway;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;

class PaymentsTest extends BookingTestCase
{
    public function test_online_booking_is_held_then_confirmed_by_the_gateway(): void
    {
        $this->actingAsPatient();
        $response = $this->book(['payment_method' => 'online'])->assertCreated()->assertJsonPath('data.status', 'held');
        $id = $response->json('data.id');
        Notification::assertNothingSent();

        // Fake gateway "checkout page" redirects back to the frontend
        $this->get($response->json('paymentUrl'))->assertRedirectContains('/my?payment=');

        $appt = Appointment::find($id);
        $this->assertSame(AppointmentStatus::Confirmed, $appt->status);
        $this->assertSame('paid', $appt->payment_status->value);
        Notification::assertSentTo($this->patient, AppointmentNotification::class, fn ($n) => $n->event === AppointmentNotification::CONFIRMED);

        // Replaying the callback changes nothing
        $this->get($response->json('paymentUrl'));
        $this->assertSame(1, Payment::where('status', 'paid')->count());
    }

    public function test_unsigned_fake_checkout_is_rejected(): void
    {
        $this->actingAsPatient();
        $id = $this->book(['payment_method' => 'online'])->json('data.id');
        $payment = Payment::where('appointment_id', $id)->first();

        $this->get("/api/v1/payments/fake/{$payment->id}")->assertForbidden();
    }

    public function test_hold_expires_after_fifteen_minutes(): void
    {
        $this->actingAsPatient();
        $id = $this->book(['payment_method' => 'online'])->json('data.id');

        Carbon::setTestNow('2026-10-26 10:16:00');
        $this->artisan('appointments:expire')->expectsOutputToContain('Expired 1 holds')->assertSuccessful();

        $this->assertSame(AppointmentStatus::Cancelled, Appointment::find($id)->status);
        $this->book(['patient_id' => $this->familyMember($this->patientUser)->id])->assertCreated(); // slot is free again
    }

    public function test_a_late_payment_revives_the_booking_when_the_slot_is_still_free(): void
    {
        $this->actingAsPatient();
        $response = $this->book(['payment_method' => 'online']);
        Carbon::setTestNow('2026-10-26 10:16:00');
        $this->artisan('appointments:expire');

        $this->get($response->json('paymentUrl'));
        $this->assertSame(AppointmentStatus::Confirmed, Appointment::find($response->json('data.id'))->status);
    }

    public function test_a_late_payment_is_refunded_when_someone_else_took_the_slot(): void
    {
        $this->actingAsPatient();
        $response = $this->book(['payment_method' => 'online']);
        Carbon::setTestNow('2026-10-26 10:16:00');
        $this->artisan('appointments:expire');
        $this->book(['patient_id' => $this->familyMember($this->patientUser)->id])->assertCreated();

        $this->get($response->json('paymentUrl'));
        $appt = Appointment::find($response->json('data.id'));
        $this->assertSame(AppointmentStatus::Cancelled, $appt->status);
        $this->assertSame('refunded', $appt->payment_status->value);
    }

    public function test_cancelling_a_paid_booking_refunds_in_full(): void
    {
        $this->actingAsPatient();
        $response = $this->book(['payment_method' => 'online']);
        $this->get($response->json('paymentUrl'));

        $this->patchJson("/api/v1/appointments/{$response->json('data.id')}/cancel", ['reason' => 'travel'])
            ->assertOk()->assertJsonPath('data.paymentStatus', 'refunded');
        $this->assertDatabaseHas('payments', ['appointment_id' => $response->json('data.id'), 'status' => 'refunded']);
    }

    public function test_moyasar_invoice_and_webhook(): void
    {
        config(['services.moyasar' => [
            'base_url' => 'https://api.moyasar.com/v1', 'secret_key' => 'sk_test', 'publishable_key' => 'pk_test', 'webhook_secret' => 'whsec',
        ]]);
        $this->app->instance(PaymentGateway::class, new MoyasarGateway(config('services.moyasar')));
        Http::fake(['api.moyasar.com/v1/invoices' => Http::response(['id' => 'inv_1', 'status' => 'initiated', 'url' => 'https://checkout.moyasar.com/invoices/inv_1'])]);

        $this->actingAsPatient();
        $response = $this->book(['payment_method' => 'online'])->assertCreated();
        $this->assertSame('https://checkout.moyasar.com/invoices/inv_1', $response->json('paymentUrl'));
        Http::assertSent(fn ($r) => $r['amount'] === 40000 // halalas
            && $r['currency'] === 'SAR'
            && $r->hasHeader('Authorization', 'Basic '.base64_encode('sk_test:')));

        $event = ['type' => 'payment_paid', 'data' => ['id' => 'pay_9', 'status' => 'paid', 'invoice_id' => 'inv_1', 'amount' => 40000]];
        $this->postJson('/api/v1/webhooks/moyasar', [...$event, 'secret_token' => 'wrong'])->assertUnauthorized();
        $this->assertSame(AppointmentStatus::Held, Appointment::find($response->json('data.id'))->status);

        $this->postJson('/api/v1/webhooks/moyasar', [...$event, 'secret_token' => 'whsec'])->assertOk();
        $this->assertSame(AppointmentStatus::Confirmed, Appointment::find($response->json('data.id'))->status);
        $this->assertDatabaseHas('payments', ['gateway_order_id' => 'inv_1', 'gateway_txn_id' => 'pay_9', 'status' => 'paid']);

        // Cancelling refunds through the same gateway
        Http::fake(['api.moyasar.com/v1/payments/pay_9/refund' => Http::response(['status' => 'refunded'])]);
        $this->patchJson("/api/v1/appointments/{$response->json('data.id')}/cancel")->assertOk()->assertJsonPath('data.paymentStatus', 'refunded');
        Http::assertSent(fn ($r) => str_ends_with($r->url(), '/payments/pay_9/refund') && $r['amount'] === 40000);
    }
}
