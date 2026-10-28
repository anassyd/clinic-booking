<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Enums\Role;
use App\Models\Appointment;
use App\Notifications\AppointmentNotification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;

class LifecycleTest extends BookingTestCase
{
    private function bookAsPatient(array $overrides = []): Appointment
    {
        $this->actingAsPatient();

        return Appointment::find($this->book($overrides)->assertCreated()->json('data.id'));
    }

    public function test_reception_confirms_a_pending_booking(): void
    {
        $appt = $this->bookAsPatient();
        $this->actingAsRole(Role::Receptionist);

        $this->getJson('/api/v1/staff/pending')->assertOk()->assertJsonCount(1, 'data');
        $this->patchJson("/api/v1/staff/appointments/{$appt->id}/confirm")->assertOk()->assertJsonPath('data.status', 'confirmed');
        $this->patchJson("/api/v1/staff/appointments/{$appt->id}/confirm")->assertStatus(422)->assertJson(['code' => 'invalid_transition']);

        Notification::assertSentTo($this->patient, AppointmentNotification::class, fn ($n) => $n->event === AppointmentNotification::CONFIRMED);
        $this->assertSame(['pending', 'confirmed'], $appt->history()->orderBy('id')->pluck('to_status')->map->value->all());
    }

    public function test_patient_can_reschedule_until_three_hours_before(): void
    {
        $appt = $this->bookAsPatient();

        $this->patchJson("/api/v1/appointments/{$appt->id}/reschedule", ['date' => '2026-10-28', 'start' => '15:00'])
            ->assertOk()->assertJsonPath('data.date', '2026-10-28')->assertJsonPath('data.end', '15:30');

        Carbon::setTestNow('2026-10-28 12:30:00'); // 2.5 h before
        $this->patchJson("/api/v1/appointments/{$appt->id}/reschedule", ['date' => '2026-10-29', 'start' => '15:00'])
            ->assertStatus(422)->assertJson(['code' => 'cutoff_passed']);
        $this->patchJson("/api/v1/appointments/{$appt->id}/cancel")->assertStatus(422)->assertJson(['code' => 'cutoff_passed']);
        $this->getJson("/api/v1/appointments/{$appt->id}")->assertJsonPath('data.canModify', false);

        // Reception can still act, with a reason (FR-41, FR-45)
        $this->actingAsRole(Role::Receptionist);
        $this->patchJson("/api/v1/appointments/{$appt->id}/cancel")->assertJsonValidationErrors('reason');
        $this->patchJson("/api/v1/appointments/{$appt->id}/cancel", ['reason' => 'patient called'])->assertOk()->assertJsonPath('data.status', 'cancelled');
    }

    public function test_rescheduling_into_a_taken_slot_fails(): void
    {
        $appt = $this->bookAsPatient();
        $this->book(['patient_id' => $this->familyMember($this->patientUser)->id, 'start' => '13:00'])->assertCreated();

        $this->patchJson("/api/v1/appointments/{$appt->id}/reschedule", ['date' => self::TOMORROW, 'start' => '13:00'])
            ->assertStatus(422)->assertJson(['code' => 'slot_taken']);
    }

    public function test_cash_payment_and_no_show_at_the_desk(): void
    {
        $appt = $this->bookAsPatient();
        $this->actingAsRole(Role::Receptionist);
        $this->patchJson("/api/v1/staff/appointments/{$appt->id}/confirm");

        $this->patchJson("/api/v1/staff/appointments/{$appt->id}/paid", ['method' => 'cash'])->assertOk()->assertJsonPath('data.paymentStatus', 'paid');
        $this->assertDatabaseHas('payments', ['appointment_id' => $appt->id, 'method' => 'cash', 'status' => 'paid', 'amount' => 400]);

        // Not before the visit has started
        $this->patchJson("/api/v1/staff/appointments/{$appt->id}/no-show")->assertStatus(422)->assertJson(['code' => 'visit_not_started']);
        $this->atVisitTime();
        $this->patchJson("/api/v1/staff/appointments/{$appt->id}/no-show")->assertOk()->assertJsonPath('data.status', 'no_show');
    }

    public function test_doctor_finishes_a_visit_without_a_follow_up(): void
    {
        $appt = $this->bookAsPatient();
        $appt->update(['status' => AppointmentStatus::Confirmed]);
        $this->actingAsRole(Role::Doctor);

        // Not ahead of the visit's day
        $this->patchJson("/api/v1/doctor/appointments/{$appt->id}/complete")->assertStatus(422)->assertJson(['code' => 'visit_not_started']);

        $this->atVisitTime();
        $this->patchJson("/api/v1/doctor/appointments/{$appt->id}/complete")
            ->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.followUpDue', null);

        Notification::assertSentTo($this->patient, AppointmentNotification::class, fn ($n) => $n->event === AppointmentNotification::COMPLETED);
    }

    public function test_doctor_calendar_ranges(): void
    {
        $this->bookAsPatient(['date' => '2026-10-31']); // Saturday
        $this->actingAsRole(Role::Doctor);

        $this->getJson('/api/v1/doctor/appointments?view=week&date=2026-10-27')
            ->assertOk()->assertJsonPath('meta.from', '2026-10-24')->assertJsonPath('meta.to', '2026-10-30')->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/doctor/appointments?view=week&date=2026-11-01')->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/doctor/appointments?from=2026-10-31&to=2026-10-31')->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/doctor/appointments?view=month&date=2026-10-15')
            ->assertJsonPath('meta.from', '2026-09-26')->assertJsonPath('meta.to', '2026-11-06')->assertJsonCount(1, 'data');
    }
}
