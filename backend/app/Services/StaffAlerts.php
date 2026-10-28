<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\Appointment;
use App\Models\User;
use App\Notifications\StaffAlert;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;

/**
 * Who hears about what in the header bell:
 *  - reception: what patients do on their own (new cash booking to confirm, cancel, reschedule)
 *    and the follow-ups doctors ask for;
 *  - the doctor: changes to their schedule for today and tomorrow, unless they made them.
 */
class StaffAlerts
{
    private const RECEPTION = [StaffAlert::NEW_PENDING, StaffAlert::CANCELLED, StaffAlert::RESCHEDULED, StaffAlert::FOLLOW_UP_REQUESTED];

    private const DOCTOR = [StaffAlert::NEW_BOOKING, StaffAlert::CANCELLED, StaffAlert::RESCHEDULED];

    /** @param array{fromDate?: string, fromStart?: string} $extra */
    public function send(Appointment $appointment, string $event, ?User $actor, array $extra = []): void
    {
        $byPatient = $actor?->role === Role::Patient;
        if (in_array($event, self::RECEPTION, true) && ($byPatient || $event === StaffAlert::FOLLOW_UP_REQUESTED)) {
            Notification::send(
                User::where('role', Role::Receptionist)->where('is_active', true)->get(),
                new StaffAlert($appointment, $event, $extra),
            );
        }

        $doctor = $appointment->doctor()->with('user')->first()?->user;
        $days = array_filter([$appointment->date, $extra['fromDate'] ?? null]);
        if (in_array($event, self::DOCTOR, true) && $doctor?->is_active && $doctor->id !== $actor?->id && $this->soon($days)) {
            $doctor->notify(new StaffAlert($appointment, $event, $extra));
        }
    }

    /** @param list<string> $days */
    private function soon(array $days): bool
    {
        $tomorrow = CarbonImmutable::tomorrow()->format('Y-m-d');
        $today = CarbonImmutable::today()->format('Y-m-d');

        return collect($days)->contains(fn (string $d) => $d >= $today && $d <= $tomorrow);
    }
}
