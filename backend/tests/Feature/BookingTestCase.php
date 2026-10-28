<?php

namespace Tests\Feature;

use App\Enums\Gender;
use App\Enums\Role;
use App\Models\Doctor;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

abstract class BookingTestCase extends TestCase
{
    use RefreshDatabase;

    /** Monday 26 Oct 2026, 10:00 Riyadh (UTC+3, no DST). Friday is 30 Oct. */
    protected const NOW = '2026-10-26 10:00:00';

    protected const TOMORROW = '2026-10-27';

    protected const FRIDAY = '2026-10-30';

    protected Doctor $doctor;

    protected User $patientUser;

    protected Patient $patient;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(self::NOW);
        Notification::fake();

        $this->doctor = Doctor::factory()->withSchedule()->create(['consultation_price' => 400, 'follow_up_price' => 0]);
        $this->doctor->load('schedules');
        $this->patientUser = User::factory()->create(['role' => Role::Patient]);
        $this->patient = $this->familyMember($this->patientUser);
    }

    protected function familyMember(User $user, array $attributes = []): Patient
    {
        return Patient::factory()->create(['user_id' => $user->id, 'gender' => Gender::Female, ...$attributes]);
    }

    protected function actingAsRole(Role $role): User
    {
        $user = User::factory()->create(['role' => $role]);
        if ($role === Role::Doctor) {
            $this->doctor->update(['user_id' => $user->id]);
        }
        Sanctum::actingAs($user);

        return $user;
    }

    /** The clock at a TOMORROW 12:00 visit: it can be finished or marked no-show now. */
    protected function atVisitTime(): void
    {
        $this->travelTo(Carbon::parse(self::TOMORROW.' 12:15'));
    }

    protected function actingAsPatient(): User
    {
        Sanctum::actingAs($this->patientUser);

        return $this->patientUser;
    }

    protected function book(array $overrides = [])
    {
        return $this->postJson('/api/v1/appointments', [
            'doctor_id' => $this->doctor->id,
            'patient_id' => $this->patient->id,
            'date' => self::TOMORROW,
            'start' => '12:00',
            'payment_method' => 'cash',
            ...$overrides,
        ]);
    }
}
