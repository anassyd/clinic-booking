<?php

namespace App\Enums;

enum AppointmentStatus: string
{
    case Held = 'held';
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Completed = 'completed';
    case NoShow = 'no_show';
    case Cancelled = 'cancelled';

    /** Statuses that occupy a slot in the doctor's schedule. */
    public static function occupying(): array
    {
        return [self::Held, self::Pending, self::Confirmed, self::Completed, self::NoShow];
    }

    /** Statuses a patient can still change or cancel. */
    public static function open(): array
    {
        return [self::Held, self::Pending, self::Confirmed];
    }

    public function isOpen(): bool
    {
        return in_array($this, self::open(), true);
    }
}
