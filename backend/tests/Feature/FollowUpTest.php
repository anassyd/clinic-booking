<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Enums\Role;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\User;
use App\Notifications\AppointmentNotification;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;

/** The doctor asks for a follow-up; reception or the patient books it like any other appointment. */
class FollowUpTest extends BookingTestCase
{
    /** A visit the doctor has just finished, asking to see the patient again by 5 Nov. */
    private function finishedVisit(): Appointment
    {
        $this->actingAsPatient();
        $visit = Appointment::find($this->book()->assertCreated()->json('data.id'));
        $visit->update(['status' => AppointmentStatus::Confirmed]);

        $this->atVisitTime();
        $this->actingAsRole(Role::Doctor);
        $this->patchJson("/api/v1/doctor/appointments/{$visit->id}/complete", [
            'follow_up' => ['due' => '2026-11-05', 'note' => 'بعد نتيجة التحليل'],
        ])->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.followUpDue', '2026-11-05')
            ->assertJsonPath('data.followUpNote', 'بعد نتيجة التحليل');

        return $visit;
    }

    private function bookFollowUp(Appointment $visit, array $overrides = [])
    {
        return $this->book(['follow_up_of' => $visit->id, 'date' => '2026-11-02', 'start' => '12:00', ...$overrides]);
    }

    public function test_the_request_reaches_the_patient_and_reception(): void
    {
        $visit = $this->finishedVisit();
        Notification::assertSentTo($this->patient, AppointmentNotification::class, fn ($n) => $n->event === AppointmentNotification::FOLLOW_UP);

        $this->actingAsRole(Role::Receptionist);
        $this->getJson('/api/v1/follow-ups')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $visit->id);

        $this->actingAsPatient();
        $this->getJson('/api/v1/follow-ups')->assertOk()->assertJsonCount(1, 'data');

        Sanctum::actingAs(User::factory()->create(['role' => Role::Patient]));
        $this->getJson('/api/v1/follow-ups')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_the_due_date_must_be_in_the_future(): void
    {
        $this->actingAsPatient();
        $visit = Appointment::find($this->book()->json('data.id'));
        $visit->update(['status' => AppointmentStatus::Confirmed]);

        $this->actingAsRole(Role::Doctor);
        $this->patchJson("/api/v1/doctor/appointments/{$visit->id}/complete", ['follow_up' => ['due' => '2026-10-26']])
            ->assertStatus(422)->assertJsonValidationErrors('follow_up.due');
    }

    public function test_the_patient_books_it_under_the_normal_rules(): void
    {
        $visit = $this->finishedVisit();
        $this->actingAsPatient();

        // Same 24-hour lead time as any patient booking
        $this->bookFollowUp($visit, ['date' => '2026-10-26', 'start' => '16:00'])->assertStatus(422)->assertJson(['code' => 'lead_time_violation']);

        $this->bookFollowUp($visit)->assertCreated()
            ->assertJsonPath('data.type', 'follow_up')
            ->assertJsonPath('data.parentId', $visit->id)
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.price', 0)
            ->assertJsonPath('data.paymentStatus', 'paid');

        $this->getJson('/api/v1/follow-ups')->assertJsonCount(0, 'data');
        $this->bookFollowUp($visit, ['date' => '2026-11-03'])->assertStatus(422)->assertJson(['code' => 'invalid_follow_up']);
    }

    public function test_reception_books_it_and_a_cancellation_reopens_the_request(): void
    {
        $visit = $this->finishedVisit();
        $this->actingAsRole(Role::Receptionist);

        $other = Doctor::factory()->withSchedule()->create();
        $this->bookFollowUp($visit, ['doctor_id' => $other->id])->assertStatus(422)->assertJson(['code' => 'invalid_follow_up']);

        $id = $this->bookFollowUp($visit)->assertCreated()->assertJsonPath('data.status', 'confirmed')->json('data.id');
        $this->getJson('/api/v1/follow-ups')->assertJsonCount(0, 'data');

        $this->patchJson("/api/v1/appointments/{$id}/cancel", ['reason' => 'patient_request'])->assertOk();
        $this->getJson('/api/v1/follow-ups')->assertJsonCount(1, 'data');
    }

    public function test_the_doctor_can_book_the_follow_up_while_finishing(): void
    {
        $this->actingAsPatient();
        $visit = Appointment::find($this->book()->json('data.id'));
        $visit->update(['status' => AppointmentStatus::Confirmed]);

        $this->atVisitTime();
        $this->actingAsRole(Role::Doctor);
        $this->patchJson("/api/v1/doctor/appointments/{$visit->id}/complete", ['follow_up' => ['due' => '2026-11-02', 'start' => '12:00']])
            ->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('followUp.type', 'follow_up')
            ->assertJsonPath('followUp.parentId', $visit->id)
            ->assertJsonPath('followUp.status', 'confirmed')
            ->assertJsonPath('followUp.paymentStatus', 'paid');

        Notification::assertSentTo($this->patient, AppointmentNotification::class, fn ($n) => $n->event === AppointmentNotification::CONFIRMED);
        Notification::assertNotSentTo($this->patient, AppointmentNotification::class, fn ($n) => $n->event === AppointmentNotification::FOLLOW_UP);
        $this->assertSame(0, Appointment::awaitingFollowUp()->count());
    }

    public function test_a_taken_follow_up_slot_rolls_the_visit_back(): void
    {
        $this->actingAsPatient();
        $visit = Appointment::find($this->book()->json('data.id'));
        $visit->update(['status' => AppointmentStatus::Confirmed]);
        $this->book(['date' => '2026-11-02', 'start' => '12:00', 'patient_id' => $this->familyMember($this->patientUser)->id])->assertCreated();

        $this->atVisitTime();
        $this->actingAsRole(Role::Doctor);
        $this->patchJson("/api/v1/doctor/appointments/{$visit->id}/complete", ['follow_up' => ['due' => '2026-11-02', 'start' => '12:00']])
            ->assertStatus(422)->assertJson(['code' => 'slot_taken']);
        $this->assertSame(AppointmentStatus::Confirmed, $visit->fresh()->status);
    }

    public function test_reception_can_dismiss_a_request(): void
    {
        $visit = $this->finishedVisit();

        $this->actingAsPatient();
        $this->patchJson("/api/v1/staff/follow-ups/{$visit->id}/dismiss")->assertForbidden();

        $this->actingAsRole(Role::Receptionist);
        $this->patchJson("/api/v1/staff/follow-ups/{$visit->id}/dismiss")->assertOk();
        $this->getJson('/api/v1/follow-ups')->assertJsonCount(0, 'data');
        $this->patchJson("/api/v1/staff/follow-ups/{$visit->id}/dismiss")->assertStatus(422)->assertJson(['code' => 'invalid_follow_up']);
    }
}
