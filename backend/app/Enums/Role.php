<?php

namespace App\Enums;

enum Role: string
{
    case Patient = 'patient';
    case Receptionist = 'receptionist';
    case Doctor = 'doctor';
    case Admin = 'admin';

    /** Staff-side roles skip the patient-only booking limits. */
    public function isStaff(): bool
    {
        return $this !== self::Patient;
    }
}
