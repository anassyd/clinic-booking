<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Enums\Role;
use App\Models\Appointment;
use App\Models\User;
use App\Notifications\StaffAlert;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

/** The header bell: who is alerted about what. */
class StaffAlertTest extends BookingTestCase
{
    private User $reception;

    private User $doctorUser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->reception = User::factory()->create(['role' => Role::Receptionist]);
        $this->doctorUser = User::factory()->create(['role' => Role::Doctor]);
        $this->doctor->update(['user_id' => $this->doctorUser->id]);
    }

    private function alerted(User $user, string $event): bool
    {
        return Notification::sent($user, StaffAlert::class)->contains(fn (StaffAlert $n) => $n->event === $event);
    }

    public function test_a_patients_cash_booking_for_tomorrow_alerts_reception_and_the_doctor(): void
    {
        $this->actingAsPatient();
        $this->book()->assertCreated();

        $this->assertTrue($this->alerted($this->reception, StaffAlert::NEW_PENDING));
        $this->assertTrue($this->alerted($this->doctorUser, StaffAlert::NEW_BOOKING));
    }

    public function test_the_doctor_only_hears_about_today_and_tomorrow(): void
    {
        $this->actingAsPatient();
        $this->book(['date' => '2026-11-02'])->assertCreated();

        $this->assertTrue($this->alerted($this->reception, StaffAlert::NEW_PENDING));
        Notification::assertNotSentTo($this->doctorUser, StaffAlert::class);
    }

    public function test_reception_is_not_alerted_about_its_own_bookings(): void
    {
        Sanctum::actingAs($this->reception);
        $this->book(['date' => '2026-10-26', 'start' => '11:00'])->assertCreated();

        Notification::assertNotSentTo($this->reception, StaffAlert::class);
        $this->assertTrue($this->alerted($this->doctorUser, StaffAlert::NEW_BOOKING));
    }

    public function test_patient_cancel_and_reschedule_alert_both(): void
    {
        $this->actingAsPatient();
        $id = $this->book(['date' => '2026-11-02'])->json('data.id');

        $this->patchJson("/api/v1/appointments/{$id}/reschedule", ['date' => self::TOMORROW, 'start' => '12:30'])->assertOk();
        $this->assertTrue($this->alerted($this->reception, StaffAlert::RESCHEDULED));
        $this->assertTrue($this->alerted($this->doctorUser, StaffAlert::RESCHEDULED));

        $this->patchJson("/api/v1/appointments/{$id}/cancel")->assertOk();
        $this->assertTrue($this->alerted($this->reception, StaffAlert::CANCELLED));
        $this->assertTrue($this->alerted($this->doctorUser, StaffAlert::CANCELLED));
    }

    public function test_a_follow_up_request_alerts_reception(): void
    {
        $this->actingAsPatient();
        $visit = Appointment::find($this->book()->json('data.id'));
        $visit->update(['status' => AppointmentStatus::Confirmed]);

        $this->atVisitTime();
        Sanctum::actingAs($this->doctorUser);
        $this->patchJson("/api/v1/doctor/appointments/{$visit->id}/complete", ['follow_up' => ['due' => '2026-11-05']])->assertOk();

        $this->assertTrue($this->alerted($this->reception, StaffAlert::FOLLOW_UP_REQUESTED));
    }

    public function test_the_bell_lists_and_marks_alerts_read(): void
    {
        foreach (['new_pending', 'cancelled'] as $i => $event) {
            $this->reception->notifications()->create([
                'id' => (string) Str::uuid(),
                'type' => $event,
                'data' => ['patient' => 'Sara', 'date' => self::TOMORROW, 'start' => '12:00'],
                'created_at' => now()->addMinutes($i),
            ]);
        }

        $this->actingAsPatient();
        $this->getJson('/api/v1/notifications')->assertForbidden();

        Sanctum::actingAs($this->reception);
        $res = $this->getJson('/api/v1/notifications')->assertOk()
            ->assertJsonPath('meta.unread', 2)
            ->assertJsonPath('data.0.event', 'cancelled');

        $this->patchJson('/api/v1/notifications/'.$res->json('data.0.id').'/read')->assertOk();
        $this->getJson('/api/v1/notifications')->assertJsonPath('meta.unread', 1);

        $this->postJson('/api/v1/notifications/read-all')->assertOk();
        $this->getJson('/api/v1/notifications')->assertJsonPath('meta.unread', 0);
    }
}
