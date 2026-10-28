<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\DoctorTimeOff;

class SlotsTest extends BookingTestCase
{
    public function test_a_working_day_has_sixteen_thirty_minute_slots(): void
    {
        $slots = $this->getJson("/api/v1/doctors/{$this->doctor->id}/slots?date=2026-10-28")->assertOk()->json('data');

        $this->assertCount(16, $slots);
        $this->assertSame(['start' => '09:00', 'end' => '09:30', 'available' => true], $slots[0]);
        $this->assertSame('16:30', end($slots)['start']);
    }

    public function test_friday_has_no_slots(): void
    {
        $this->getJson("/api/v1/doctors/{$this->doctor->id}/slots?date=".self::FRIDAY)->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_patients_cannot_book_within_24_hours(): void
    {
        $slots = collect($this->getJson("/api/v1/doctors/{$this->doctor->id}/slots?date=".self::TOMORROW)->json('data'))->keyBy('start');

        $this->assertFalse($slots['09:30']['available']); // 23.5 h ahead
        $this->assertTrue($slots['10:30']['available']); // 24.5 h ahead
    }

    public function test_staff_see_same_day_slots(): void
    {
        $this->actingAsRole(Role::Receptionist);
        $slots = collect($this->getJson("/api/v1/doctors/{$this->doctor->id}/slots?date=2026-10-26")->json('data'))->keyBy('start');

        $this->assertFalse($slots['09:30']['available']); // already past
        $this->assertTrue($slots['10:30']['available']);
    }

    public function test_availability_strip_starts_tomorrow_for_patients_and_marks_friday_closed(): void
    {
        $days = collect($this->getJson("/api/v1/doctors/{$this->doctor->id}/availability")->assertOk()->json('data'))->keyBy('date');

        $this->assertArrayNotHasKey('2026-10-26', $days->all());
        $this->assertSame('closed', $days[self::FRIDAY]['status']);
        $this->assertSame('available', $days['2026-10-28']['status']);
        $this->assertSame(16, $days['2026-10-28']['free']);
        $this->assertCount(30, $days); // tomorrow … +30 days
    }

    public function test_time_off_removes_slots(): void
    {
        DoctorTimeOff::create(['doctor_id' => $this->doctor->id, 'date' => '2026-10-28', 'start_time' => '09:00', 'end_time' => '12:00']);
        DoctorTimeOff::create(['doctor_id' => null, 'date' => '2026-10-29']); // center-wide holiday

        $slots = collect($this->getJson("/api/v1/doctors/{$this->doctor->id}/slots?date=2026-10-28")->json('data'))->keyBy('start');
        $this->assertFalse($slots['11:30']['available']);
        $this->assertTrue($slots['12:00']['available']);

        $this->getJson("/api/v1/doctors/{$this->doctor->id}/slots?date=2026-10-29")->assertJsonCount(0, 'data');

        $this->actingAsPatient();
        $this->book(['date' => '2026-10-28', 'start' => '10:00'])->assertStatus(422)->assertJson(['code' => 'doctor_unavailable']);
    }
}
