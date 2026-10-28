<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Appointment;

/** Reception takes the money at the desk: cash, mada/card on the POS, or bank transfer. */
class DeskPaymentTest extends BookingTestCase
{
    public function test_quick_booking_paid_now_by_card_is_confirmed_and_records_who_took_it(): void
    {
        $staff = $this->actingAsRole(Role::Receptionist);

        $id = $this->book(['payment' => ['method' => 'card', 'reference' => 'POS-7781']])
            ->assertCreated()
            ->assertJsonPath('data.status', 'confirmed')
            ->assertJsonPath('data.paymentMethod', 'card')
            ->assertJsonPath('data.paymentStatus', 'paid')
            ->json('data.id');

        $this->assertDatabaseHas('payments', [
            'appointment_id' => $id, 'method' => 'card', 'status' => 'paid', 'amount' => 400,
            'received_by' => $staff->id, 'reference' => 'POS-7781',
        ]);
    }

    public function test_quick_booking_without_payment_waits_for_arrival(): void
    {
        $this->actingAsRole(Role::Receptionist);

        $this->book()->assertCreated()->assertJsonPath('data.paymentStatus', 'unpaid')->assertJsonPath('data.paymentMethod', 'cash');
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_bank_transfer_needs_a_reference(): void
    {
        $this->actingAsRole(Role::Receptionist);

        $this->book(['payment' => ['method' => 'transfer']])->assertJsonValidationErrors('payment.reference');
        $this->assertDatabaseCount('appointments', 0);
    }

    public function test_patients_cannot_record_a_desk_payment_or_pick_a_desk_method(): void
    {
        $this->actingAsPatient();

        $this->book(['payment' => ['method' => 'cash']])->assertJsonValidationErrors('payment');
        $this->book(['payment_method' => 'card'])->assertJsonValidationErrors('payment_method');
    }

    public function test_marking_paid_on_arrival_records_method_reference_and_receiver(): void
    {
        $this->actingAsRole(Role::Receptionist);
        $id = $this->book()->json('data.id');
        $staff = $this->actingAsRole(Role::Receptionist);

        $this->patchJson("/api/v1/staff/appointments/{$id}/paid", ['method' => 'online'])->assertJsonValidationErrors('method');
        $this->patchJson("/api/v1/staff/appointments/{$id}/paid", ['method' => 'transfer', 'reference' => 'TRX-55'])
            ->assertOk()
            ->assertJsonPath('data.paymentMethod', 'transfer');

        $this->assertDatabaseHas('payments', ['appointment_id' => $id, 'method' => 'transfer', 'reference' => 'TRX-55', 'received_by' => $staff->id]);

        // Collected once only
        $this->patchJson("/api/v1/staff/appointments/{$id}/paid", ['method' => 'cash'])->assertStatus(422)->assertJson(['code' => 'invalid_transition']);
        $this->assertSame(1, Appointment::find($id)->payments()->count());
    }

    public function test_reception_finds_a_patient_by_name_phone_or_partial_id_and_sees_their_visits(): void
    {
        $this->patient->update(['name' => 'منيرة القحطاني', 'phone' => '0551112233', 'national_id' => '1098765432']);
        $this->actingAsRole(Role::Receptionist);
        $this->book()->assertCreated();

        foreach (['منيرة', '1112233', '109876'] as $q) {
            $this->getJson('/api/v1/patients/search?q='.urlencode($q))->assertOk()->assertJsonPath('data.0.id', $this->patient->id);
        }

        $this->getJson("/api/v1/staff/appointments?patient_id={$this->patient->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.date', self::TOMORROW);
    }
}
