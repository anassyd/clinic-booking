<?php

namespace App\Notifications;

use App\Models\Appointment;
use Illuminate\Notifications\Notification;

/**
 * In-app alert for the header bell (reception and doctors). Stored only in the database;
 * the frontend words it from `event` + the details below, in the viewer's language.
 */
class StaffAlert extends Notification
{
    public const NEW_PENDING = 'new_pending';

    public const NEW_BOOKING = 'new_booking';

    public const CANCELLED = 'cancelled';

    public const RESCHEDULED = 'rescheduled';

    public const FOLLOW_UP_REQUESTED = 'follow_up_requested';

    public function __construct(public Appointment $appointment, public string $event, public array $extra = []) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return $this->event;
    }

    public function toArray(object $notifiable): array
    {
        $a = $this->appointment->loadMissing('patient');

        return [
            'appointmentId' => $a->id,
            'patientId' => $a->patient_id,
            'patient' => $a->patient->name,
            'doctorId' => $a->doctor_id,
            'date' => $a->date,
            'start' => $a->start_time,
            'due' => $a->follow_up_due,
            ...$this->extra,
        ];
    }
}
