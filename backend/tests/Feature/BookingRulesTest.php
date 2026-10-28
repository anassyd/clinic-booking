<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Enums\Role;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\Patient;
use App\Models\User;
use App\Notifications\AppointmentNotification;
use App\Support\ClinicSettings;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Notification;

class BookingRulesTest extends BookingTestCase
{
    public function test_cash_booking_by_a_patient_waits_for_confirmation(): void
    {
        $this->actingAsPatient();

        $response = $this->book()->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.price', 400)
            ->assertJsonPath('data.bookedBy', 'patient')
            ->assertJsonMissingPath('paymentUrl');

        // 12 h after booking comes before "6 h before the visit"
        $this->assertSame('2026-10-26T22:00:00+03:00', $response->json('data.pendingExpiresAt'));
        Notification::assertSentTo($this->patient, AppointmentNotification::class, fn ($n) => $n->event === AppointmentNotification::PENDING);
    }

    public function test_a_new_patient_can_be_created_with_the_booking(): void
    {
        $this->actingAsPatient();

        $this->book(['patient_id' => null, 'patient' => [
            'name' => 'يوسف خالد', 'email' => 'y@example.com', 'phone' => '0501234567', 'birth_date' => '2019-07-02', 'gender' => 'male',
        ]])->assertCreated()->assertJsonPath('data.patient.name', 'يوسف خالد');

        $this->assertSame(2, $this->patientUser->patients()->count());
    }

    public function test_the_same_slot_cannot_be_booked_twice(): void
    {
        $this->actingAsPatient();
        $this->book()->assertCreated();

        $other = $this->familyMember($this->patientUser);
        $this->book(['patient_id' => $other->id])->assertStatus(422)->assertJson(['code' => 'slot_taken']);
    }

    public function test_the_database_rejects_a_double_booking_even_without_the_service(): void
    {
        $this->actingAsPatient();
        $first = Appointment::find($this->book()->json('data.id'));

        $this->expectException(UniqueConstraintViolationException::class);
        Appointment::create([...$first->only(['doctor_id', 'date', 'start_time', 'end_time', 'price', 'payment_method', 'booked_by_role']),
            'patient_id' => $this->familyMember($this->patientUser)->id, 'status' => AppointmentStatus::Confirmed]);
    }

    public function test_a_cancelled_slot_can_be_booked_again(): void
    {
        $this->actingAsPatient();
        $id = $this->book()->json('data.id');
        $this->patchJson("/api/v1/appointments/{$id}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelled');

        $this->book(['patient_id' => $this->familyMember($this->patientUser)->id])->assertCreated();
    }

    public function test_one_consultation_per_patient_per_day_but_family_members_can_book(): void
    {
        $this->actingAsPatient();
        $this->book()->assertCreated();
        $this->book(['start' => '13:00'])->assertStatus(422)->assertJson(['code' => 'daily_limit_reached']);

        $son = $this->familyMember($this->patientUser);
        $this->book(['patient_id' => $son->id, 'start' => '13:00'])->assertCreated();
    }

    public function test_patient_time_limits(): void
    {
        $this->actingAsPatient();

        $this->book(['date' => self::TOMORROW, 'start' => '09:30'])->assertStatus(422)->assertJson(['code' => 'lead_time_violation']);
        $this->book(['date' => '2026-12-05'])->assertStatus(422)->assertJson(['code' => 'too_far_ahead']);
        $this->book(['date' => self::FRIDAY])->assertStatus(422)->assertJson(['code' => 'day_off']);
        $this->book(['start' => '12:10'])->assertStatus(422)->assertJson(['code' => 'invalid_slot']);
        $this->book(['start' => '18:00'])->assertStatus(422)->assertJson(['code' => 'invalid_slot']);
    }

    public function test_at_most_five_pending_cash_bookings_per_account(): void
    {
        $this->actingAsPatient();
        foreach (['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-31', '2026-11-01'] as $date) {
            $this->book(['date' => $date])->assertCreated();
        }
        $this->book(['date' => '2026-11-02'])->assertStatus(422)->assertJson(['code' => 'pending_limit_reached']);
        $this->book(['date' => '2026-11-02', 'payment_method' => 'online'])->assertCreated(); // online is unaffected
    }

    public function test_staff_book_same_day_and_it_is_confirmed_immediately(): void
    {
        $this->actingAsRole(Role::Receptionist);
        $walkIn = Patient::factory()->create(); // no account

        $this->book(['patient_id' => $walkIn->id, 'date' => '2026-10-26', 'start' => '11:00'])
            ->assertCreated()
            ->assertJsonPath('data.status', 'confirmed')
            ->assertJsonPath('data.paymentMethod', 'cash');

        $this->book(['patient_id' => $walkIn->id, 'date' => '2026-10-26', 'start' => '09:00', 'patient' => null])
            ->assertStatus(422)->assertJson(['code' => 'slot_in_past']);
    }

    public function test_patients_cannot_book_for_someone_elses_family(): void
    {
        $this->actingAsPatient();
        $stranger = $this->familyMember(User::factory()->create());

        $this->book(['patient_id' => $stranger->id])->assertForbidden();
    }

    public function test_doctors_book_only_into_their_own_schedule(): void
    {
        $this->actingAsRole(Role::Doctor);
        $this->book(['date' => '2026-10-26', 'start' => '11:00'])->assertCreated()->assertJsonPath('data.status', 'confirmed');

        $other = Doctor::factory()->withSchedule()->create();
        $this->book(['doctor_id' => $other->id])->assertForbidden();
    }

    public function test_validation_errors_are_translated(): void
    {
        $this->actingAsPatient();
        $this->withHeader('Accept-Language', 'ar')->book(['patient_id' => null, 'patient' => ['phone' => '123']])
            ->assertStatus(422)->assertJsonValidationErrors(['patient.phone', 'patient.name']);

        $this->withHeader('Accept-Language', 'ar')->book(['start' => '09:30'])
            ->assertJson(['message' => 'يجب أن يتم الحجز قبل الموعد بـ 24 ساعة على الأقل.']);
    }

    public function test_national_id_is_optional_but_validated(): void
    {
        $this->actingAsPatient();
        $patient = ['name' => 'عبدالله العتيبي', 'email' => 'a@example.com', 'phone' => '0501234567', 'birth_date' => '2019-07-02', 'gender' => 'male'];

        $this->postJson('/api/v1/patients', [...$patient, 'national_id' => '3123456789'])->assertJsonValidationErrors('national_id');
        $this->postJson('/api/v1/patients', [...$patient, 'phone' => '01012345678'])->assertJsonValidationErrors('phone');
        $this->postJson('/api/v1/patients', [...$patient, 'national_id' => '2123456789'])->assertCreated()->assertJsonPath('data.nationalId', '2123456789');
        $this->postJson('/api/v1/patients', $patient)->assertCreated();
    }

    public function test_prices_are_vat_inclusive_when_vat_is_enabled(): void
    {
        $this->actingAsPatient();
        $this->book()->assertJsonPath('data.price', 400)->assertJsonPath('data.vatAmount', 0);

        ClinicSettings::update(['vat_rate' => 15]);
        $this->book(['patient_id' => $this->familyMember($this->patientUser)->id, 'start' => '13:00'])
            ->assertJsonPath('data.price', 400)
            ->assertJsonPath('data.vatAmount', 52.17);
    }
}
