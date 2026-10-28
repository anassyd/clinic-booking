<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Appointment;
use App\Services\Payments\MoyasarGateway;
use App\Services\Payments\PaymentGateway;
use Illuminate\Support\Facades\Http;

class RefundRetryTest extends BookingTestCase
{
    public function test_a_failed_gateway_refund_is_kept_pending_and_can_be_retried(): void
    {
        config(['services.moyasar' => ['base_url' => 'https://api.moyasar.com/v1', 'secret_key' => 'sk', 'publishable_key' => 'pk', 'webhook_secret' => 'wh']]);
        $this->app->instance(PaymentGateway::class, new MoyasarGateway(config('services.moyasar')));
        Http::fake([
            'api.moyasar.com/v1/invoices' => Http::response(['id' => 'inv_1', 'url' => 'https://checkout.moyasar.com/invoices/inv_1']),
            'api.moyasar.com/v1/payments/pay_1/refund' => Http::sequence()
                ->push(['message' => 'Gateway timeout'], 504)
                ->push(['status' => 'refunded']),
        ]);

        $this->actingAsPatient();
        $id = $this->book(['payment_method' => 'online'])->json('data.id');
        $this->postJson('/api/v1/webhooks/moyasar', ['type' => 'payment_paid', 'secret_token' => 'wh', 'data' => ['id' => 'pay_1', 'status' => 'paid', 'invoice_id' => 'inv_1']])->assertOk();

        // Cancellation stands even though the gateway refused the refund
        $this->patchJson("/api/v1/appointments/{$id}/cancel")->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.paymentStatus', 'refund_pending');

        $this->actingAsRole(Role::Admin);
        $list = $this->getJson('/api/v1/admin/refunds')->assertOk()->assertJsonCount(1, 'data');
        $paymentId = $list->json('data.0.id');
        $this->assertSame(1, $list->json('data.0.attempts'));
        $this->assertNotEmpty($list->json('data.0.error'));

        $this->postJson("/api/v1/admin/refunds/{$paymentId}/retry")->assertOk()->assertJson(['ok' => true])
            ->assertJsonPath('data.status', 'refunded');
        $this->assertSame('refunded', Appointment::find($id)->payment_status->value);
        $this->getJson('/api/v1/admin/refunds')->assertJsonCount(0, 'data');
    }

    public function test_only_admins_see_refunds(): void
    {
        $this->actingAsRole(Role::Receptionist);
        $this->getJson('/api/v1/admin/refunds')->assertForbidden();
    }
}
