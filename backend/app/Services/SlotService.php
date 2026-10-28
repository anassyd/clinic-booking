<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\DoctorTimeOff;
use App\Support\ClinicSettings;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Slots are never stored: they are computed from the doctor's weekly schedule,
 * minus time off, minus appointments that occupy a slot (SRS FR-21).
 */
class SlotService
{
    /** @return list<array{start: string, end: string}> */
    public function slotTimes(string $start, string $end): array
    {
        $minutes = ClinicSettings::int('slot_minutes');
        $cursor = CarbonImmutable::createFromFormat('H:i', substr($start, 0, 5));
        $stop = CarbonImmutable::createFromFormat('H:i', substr($end, 0, 5));
        $slots = [];
        while ($cursor < $stop) {
            $next = $cursor->addMinutes($minutes);
            $slots[] = ['start' => $cursor->format('H:i'), 'end' => $next->format('H:i')];
            $cursor = $next;
        }

        return $slots;
    }

    /** Earliest moment the given role may book. */
    public function earliestBookable(Role $role): CarbonImmutable
    {
        $now = CarbonImmutable::now();

        return $role->isStaff() ? $now : $now->addHours(ClinicSettings::int('min_booking_lead_hours'));
    }

    /**
     * All slots of one day with their availability for the given role.
     *
     * @return list<array{start: string, end: string, available: bool}>
     */
    public function slotsFor(Doctor $doctor, CarbonImmutable $date, Role $role, ?int $ignoreAppointmentId = null): array
    {
        $day = $date->startOfDay();
        $schedule = $doctor->scheduleFor($day->dayOfWeek);
        if (! $schedule || ClinicSettings::isWeeklyOff($day->dayOfWeek)) {
            return [];
        }

        $timeOff = $this->timeOff($doctor, $day, $day);
        if ($timeOff->contains(fn (DoctorTimeOff $t) => $t->isFullDay())) {
            return [];
        }

        $busy = $this->busyStarts($doctor, $day, $day, $ignoreAppointmentId)->get($day->format('Y-m-d'), collect());
        $earliest = $this->earliestBookable($role);

        return array_map(fn (array $slot) => [
            ...$slot,
            'available' => ! $busy->contains($slot['start'])
                && ! $timeOff->contains(fn (DoctorTimeOff $t) => $t->covers($slot['start']))
                && $day->setTimeFromTimeString($slot['start']) > $earliest,
        ], $this->slotTimes($schedule->start_time, $schedule->end_time));
    }

    public function isBookable(Doctor $doctor, CarbonImmutable $date, string $start, Role $role, ?int $ignoreAppointmentId = null): bool
    {
        return collect($this->slotsFor($doctor, $date, $role, $ignoreAppointmentId))
            ->contains(fn (array $s) => $s['start'] === $start && $s['available']);
    }

    /** Does $start fall on the doctor's slot grid that day (ignoring availability)? */
    public function isOnGrid(Doctor $doctor, CarbonImmutable $date, string $start): bool
    {
        $schedule = $doctor->scheduleFor($date->dayOfWeek);

        return $schedule !== null
            && collect($this->slotTimes($schedule->start_time, $schedule->end_time))->contains('start', $start);
    }

    /** Is the slot inside the doctor's (or the whole center's) time off? */
    public function isTimeOff(Doctor $doctor, CarbonImmutable $date, string $start): bool
    {
        return $this->timeOff($doctor, $date, $date)->contains(fn (DoctorTimeOff $t) => $t->covers($start));
    }

    /**
     * Day-by-day status for the booking calendar strip.
     *
     * @return list<array{date: string, status: string, free: int}>
     */
    public function availability(Doctor $doctor, Role $role): array
    {
        $today = CarbonImmutable::today();
        // Patients can never book today (lead time), so their strip starts tomorrow
        $from = $role->isStaff() ? $today : $today->addDay();
        $to = $today->addDays(ClinicSettings::int('max_booking_days_ahead'));

        $busy = $this->busyStarts($doctor, $from, $to);
        $timeOff = $this->timeOff($doctor, $from, $to)->groupBy('date');
        $earliest = $this->earliestBookable($role);
        $days = [];

        for ($day = $from; $day <= $to; $day = $day->addDay()) {
            $key = $day->format('Y-m-d');
            if (ClinicSettings::isWeeklyOff($day->dayOfWeek)) {
                $days[] = ['date' => $key, 'status' => 'closed', 'free' => 0];

                continue;
            }
            $schedule = $doctor->scheduleFor($day->dayOfWeek);
            $off = $timeOff->get($key, collect());
            if (! $schedule || $off->contains(fn (DoctorTimeOff $t) => $t->isFullDay())) {
                $days[] = ['date' => $key, 'status' => 'off', 'free' => 0];

                continue;
            }
            $taken = $busy->get($key, collect());
            $free = collect($this->slotTimes($schedule->start_time, $schedule->end_time))
                ->filter(fn (array $s) => ! $taken->contains($s['start'])
                    && ! $off->contains(fn (DoctorTimeOff $t) => $t->covers($s['start']))
                    && $day->setTimeFromTimeString($s['start']) > $earliest)
                ->count();
            $days[] = ['date' => $key, 'status' => $free > 0 ? 'available' : 'full', 'free' => $free];
        }

        return $days;
    }

    /** @return Collection<string, Collection<int, string>> start times keyed by date */
    private function busyStarts(Doctor $doctor, CarbonImmutable $from, CarbonImmutable $to, ?int $ignoreId = null): Collection
    {
        return Appointment::query()
            ->where('doctor_id', $doctor->id)
            ->whereBetween('date', [$from->format('Y-m-d'), $to->format('Y-m-d')])
            ->occupying()
            ->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))
            ->get(['date', 'start_time'])
            ->groupBy('date')
            ->map(fn (Collection $list) => $list->pluck('start_time'));
    }

    /** @return Collection<int, DoctorTimeOff> doctor's own time off plus center-wide closures */
    private function timeOff(Doctor $doctor, CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return DoctorTimeOff::query()
            ->where(fn ($q) => $q->where('doctor_id', $doctor->id)->orWhereNull('doctor_id'))
            ->whereBetween('date', [$from->format('Y-m-d'), $to->format('Y-m-d')])
            ->get();
    }
}
