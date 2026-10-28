<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Appointment;
use App\Models\User;

class AppointmentPolicy
{
    /** Patients see their own family's bookings, doctors their own schedule (NFR-03). */
    public function view(User $user, Appointment $appointment): bool
    {
        return match ($user->role) {
            Role::Receptionist, Role::Admin => true,
            Role::Doctor => $appointment->doctor_id === $user->doctor?->id,
            Role::Patient => $appointment->patient?->user_id === $user->id,
        };
    }

    /** Reschedule / cancel. Time limits are enforced by BookingService. */
    public function modify(User $user, Appointment $appointment): bool
    {
        return $this->view($user, $appointment);
    }

    public function pay(User $user, Appointment $appointment): bool
    {
        return $user->role === Role::Patient && $this->view($user, $appointment);
    }

    /** Finish a visit, mark no-show. */
    public function treat(User $user, Appointment $appointment): bool
    {
        return $user->role === Role::Doctor && $this->view($user, $appointment);
    }
}
