<?php

namespace App\Policies;

use App\Models\Patient;
use App\Models\User;

class PatientPolicy
{
    /** Booking for / editing a patient: staff for anyone, account holders for their family. */
    public function use(User $user, Patient $patient): bool
    {
        return $user->role->isStaff() || $patient->user_id === $user->id;
    }
}
