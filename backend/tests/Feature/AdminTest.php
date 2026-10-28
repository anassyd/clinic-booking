<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Notifications\AppointmentNotification;
use Illuminate\Support\Facades\Notification;

class AdminTest extends BookingTestCase
{
    public function test_settings_override_the_defaults(): void
    {
        $this->actingAsRole(Role::Admin);
        $this->putJson('/api/v1/admin/settings', ['min_booking_lead_hours' => 2, 'weekly_off_days' => [5, 6]])
            ->assertOk()->assertJsonPath('data.min_booking_lead_hours', 2);

        $this->actingAsPatient();
        $this->book(['date' => '2026-10-26', 'start' => '13:00'])->assertCreated(); // 3 h ahead now allowed
        $this->book(['patient_id' => $this->familyMember($this->patientUser)->id, 'date' => '2026-10-31'])
            ->assertStatus(422)->assertJson(['code' => 'day_off']); // Saturday is now off
    }

    public function test_time_off_reports_and_can_cancel_affected_bookings(): void
    {
        $this->actingAsPatient();
        $id = $this->book(['date' => '2026-10-28', 'start' => '10:00'])->json('data.id');
        $this->book(['date' => '2026-10-28', 'start' => '15:00', 'patient_id' => $this->familyMember($this->patientUser)->id]);

        $this->actingAsRole(Role::Admin);
        $this->postJson('/api/v1/admin/time-off', [
            'doctor_id' => $this->doctor->id, 'date' => '2026-10-28', 'start' => '09:00', 'end' => '12:00',
            'reason' => 'conference', 'cancel_affected' => true,
        ])->assertCreated()->assertJsonCount(1, 'affected')->assertJsonPath('affected.0.id', $id);

        $this->assertDatabaseHas('appointments', ['id' => $id, 'status' => 'cancelled', 'cancel_reason' => 'conference']);
        Notification::assertSentTo($this->patient, AppointmentNotification::class, fn ($n) => $n->event === AppointmentNotification::CANCELLED);
    }

    public function test_changing_a_schedule_lists_bookings_left_outside_it(): void
    {
        $this->actingAsPatient();
        $id = $this->book(['date' => '2026-10-28', 'start' => '16:00'])->json('data.id');

        $this->actingAsRole(Role::Admin);
        $this->putJson("/api/v1/admin/doctors/{$this->doctor->id}/schedules", ['schedules' => [
            ['day_of_week' => 3, 'start' => '09:00', 'end' => '13:00'],
        ]])->assertOk()->assertJsonCount(1, 'data.schedules')->assertJsonPath('outsideSchedule.0.id', $id);
    }

    public function test_reports_and_csv_export(): void
    {
        $this->actingAsPatient();
        $this->book()->assertCreated();

        $this->actingAsRole(Role::Admin);
        $this->getJson('/api/v1/admin/reports?from=2026-10-24&to=2026-10-30')
            ->assertOk()
            ->assertJsonPath('data.0.booked', 1)
            ->assertJsonPath('data.0.capacity', 16 * 6)
            ->assertJsonPath('totals.booked', 1);

        $csv = $this->get('/api/v1/admin/reports?from=2026-10-24&to=2026-10-30&format=csv')->assertOk()->streamedContent();
        $this->assertStringContainsString('doctor,specialty,booked', $csv);
    }

    public function test_admin_creates_staff_and_specialties(): void
    {
        $this->actingAsRole(Role::Admin);

        $this->postJson('/api/v1/admin/staff', ['name' => 'هبة السيد', 'email' => 'h@clinic.test', 'password' => 'secret123', 'role' => 'receptionist'])
            ->assertCreated()->assertJsonPath('data.role', 'receptionist');
        $this->postJson('/api/v1/admin/staff', ['name' => 'Nope', 'email' => 'n@clinic.test', 'password' => 'secret123', 'role' => 'patient'])
            ->assertJsonValidationErrors('role');

        $this->postJson('/api/v1/admin/specialties', ['slug' => 'ent', 'name' => ['ar' => 'أنف وأذن', 'en' => 'ENT']])
            ->assertCreated()->assertJsonPath('data.name.en', 'ENT');
        $this->getJson('/api/v1/specialties')->assertOk()->assertJsonFragment(['slug' => 'ent']);
    }
}
