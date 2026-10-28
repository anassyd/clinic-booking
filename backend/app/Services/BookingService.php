<?php

namespace App\Services;

use App\Enums\AppointmentStatus;
use App\Enums\AppointmentType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Exceptions\BookingException;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\Patient;
use App\Models\User;
use App\Notifications\AppointmentNotification;
use App\Notifications\StaffAlert;
use App\Services\Payments\PaymentService;
use App\Support\ClinicSettings;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Every appointment state change goes through here so the SRS rules (§4) and the
 * status history (FR-98) are enforced in one place.
 */
class BookingService
{
    public function __construct(
        private readonly SlotService $slots,
        private readonly PaymentService $payments,
        private readonly StaffAlerts $alerts,
    ) {}

    /* ------------------------------------------------------------------ */
    /* Create */
    /* ------------------------------------------------------------------ */

    public function book(
        User $actor,
        Doctor $doctor,
        Patient $patient,
        string $date,
        string $start,
        PaymentMethod $method,
        ?string $notes = null,
        ?Appointment $followUpOf = null,
    ): Appointment {
        $role = $actor->role;
        if ($followUpOf) {
            $this->assertFollowUpFor($followUpOf, $doctor, $patient);
        }
        $price = $followUpOf ? $doctor->follow_up_price : $doctor->consultation_price;
        // A free follow-up has nothing to pay online
        if ($price === 0) {
            $method = PaymentMethod::Cash;
        }
        $day = CarbonImmutable::parse($date)->startOfDay();
        $startsAt = $day->setTimeFromTimeString($start);

        $this->assertBookableDay($doctor, $day, $start);

        if (! $role->isStaff()) {
            if ($startsAt <= $this->slots->earliestBookable($role)) {
                throw new BookingException('lead_time_violation');
            }
            if ($day > CarbonImmutable::today()->addDays(ClinicSettings::int('max_booking_days_ahead'))) {
                throw new BookingException('too_far_ahead');
            }
            if ($method === PaymentMethod::Cash && $this->pendingCountFor($actor) >= ClinicSettings::int('max_pending_per_account')) {
                throw new BookingException('pending_limit_reached');
            }
        } elseif ($startsAt < CarbonImmutable::now()) {
            throw new BookingException('slot_in_past');
        }

        $status = match (true) {
            $role->isStaff() => AppointmentStatus::Confirmed,
            $method === PaymentMethod::Online => AppointmentStatus::Held,
            default => AppointmentStatus::Pending,
        };

        $appointment = $this->insert($doctor, $day, $start, function (Appointment $a) use ($patient, $actor, $status, $method, $notes, $startsAt, $day, $price, $followUpOf) {
            if ($this->hasConsultationOn($patient, $day->format('Y-m-d'))) {
                throw new BookingException('daily_limit_reached');
            }

            $a->fill([
                'patient_id' => $patient->id,
                'parent_id' => $followUpOf?->id,
                'type' => $followUpOf ? AppointmentType::FollowUp : AppointmentType::Consultation,
                'status' => $status,
                'price' => $price,
                'payment_method' => $method,
                'payment_status' => $price === 0 ? PaymentStatus::Paid : PaymentStatus::Unpaid,
                'booked_by' => $actor->id,
                'booked_by_role' => $actor->role,
                'notes' => $notes,
                'hold_expires_at' => $status === AppointmentStatus::Held
                    ? now()->addMinutes(ClinicSettings::int('payment_hold_minutes')) : null,
                'pending_expires_at' => $status === AppointmentStatus::Pending ? $this->pendingDeadline($startsAt) : null,
                'confirmed_by' => $status === AppointmentStatus::Confirmed ? $actor->id : null,
                'confirmed_at' => $status === AppointmentStatus::Confirmed ? now() : null,
            ]);
        }, $actor);

        match ($status) {
            AppointmentStatus::Pending => $this->notify($appointment, AppointmentNotification::PENDING),
            AppointmentStatus::Confirmed => $this->notify($appointment, AppointmentNotification::CONFIRMED),
            default => null, // held: notified once the payment succeeds
        };
        if ($status === AppointmentStatus::Pending) {
            $this->alerts->send($appointment, StaffAlert::NEW_PENDING, $actor);
        }
        if ($status !== AppointmentStatus::Held) {
            $this->alerts->send($appointment, StaffAlert::NEW_BOOKING, $actor);
        }

        return $appointment;
    }

    /* ------------------------------------------------------------------ */
    /* Changes by patient or staff */
    /* ------------------------------------------------------------------ */

    public function reschedule(User $actor, Appointment $appointment, string $date, string $start): Appointment
    {
        $this->assertModifiable($actor, $appointment);
        $doctor = $appointment->doctor;
        $day = CarbonImmutable::parse($date)->startOfDay();
        $this->assertBookableDay($doctor, $day, $start);
        $from = ['fromDate' => $appointment->date, 'fromStart' => $appointment->start_time];

        if (! $this->slots->isBookable($doctor, $day, $start, $actor->role, $appointment->id)) {
            throw new BookingException('slot_taken');
        }

        try {
            DB::transaction(function () use ($appointment, $day, $start) {
                Doctor::query()->whereKey($appointment->doctor_id)->lockForUpdate()->first();
                $appointment->update([
                    'date' => $day->format('Y-m-d'),
                    'start_time' => $start,
                    'end_time' => $day->setTimeFromTimeString($start)->addMinutes(ClinicSettings::int('slot_minutes'))->format('H:i'),
                    'reminder_sent_at' => null,
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            throw new BookingException('slot_taken');
        }

        $this->notify($appointment, AppointmentNotification::RESCHEDULED);
        $this->alerts->send($appointment, StaffAlert::RESCHEDULED, $actor, $from);

        return $appointment->refresh();
    }

    public function cancel(?User $actor, Appointment $appointment, ?string $reason = null): Appointment
    {
        if ($actor) {
            $this->assertModifiable($actor, $appointment);
        } elseif (! $appointment->status->isOpen()) {
            throw new BookingException('not_cancellable');
        }

        DB::transaction(function () use ($actor, $appointment, $reason) {
            $this->transition($appointment, AppointmentStatus::Cancelled, $actor, $reason, [
                'cancelled_by' => $actor?->id,
                'cancelled_at' => now(),
                'cancel_reason' => $reason,
            ]);
            $this->payments->refund($appointment);
        });

        $this->notify($appointment, AppointmentNotification::CANCELLED);
        if ($actor) {
            $this->alerts->send($appointment, StaffAlert::CANCELLED, $actor);
        }

        return $appointment->refresh();
    }

    /* ------------------------------------------------------------------ */
    /* Reception */
    /* ------------------------------------------------------------------ */

    public function confirm(User $actor, Appointment $appointment): Appointment
    {
        if ($appointment->status !== AppointmentStatus::Pending) {
            throw new BookingException('invalid_transition');
        }
        $this->transition($appointment, AppointmentStatus::Confirmed, $actor, null, [
            'confirmed_by' => $actor->id,
            'confirmed_at' => now(),
            'pending_expires_at' => null,
        ]);
        $this->notify($appointment, AppointmentNotification::CONFIRMED);

        return $appointment;
    }

    public function markPaid(User $actor, Appointment $appointment, PaymentMethod $method, ?string $reference = null): Appointment
    {
        if (! $method->isDesk() || $appointment->payment_status !== PaymentStatus::Unpaid || $appointment->status === AppointmentStatus::Cancelled) {
            throw new BookingException('invalid_transition');
        }
        $this->payments->recordDesk($appointment, $method, $actor, $reference);

        return $appointment->refresh();
    }

    /** Reception closes a follow-up request without booking it (e.g. the patient declined). */
    public function dismissFollowUp(Appointment $appointment): Appointment
    {
        if (! Appointment::awaitingFollowUp()->whereKey($appointment->id)->exists()) {
            throw new BookingException('invalid_follow_up');
        }
        $appointment->update(['follow_up_closed_at' => now()]);

        return $appointment;
    }

    public function markNoShow(User $actor, Appointment $appointment): Appointment
    {
        if ($appointment->status !== AppointmentStatus::Confirmed) {
            throw new BookingException('invalid_transition');
        }
        // Nobody can miss a visit that hasn't started yet
        if ($appointment->startsAt()->isFuture()) {
            throw new BookingException('visit_not_started');
        }
        $this->transition($appointment, AppointmentStatus::NoShow, $actor);

        return $appointment;
    }

    /* ------------------------------------------------------------------ */
    /* Doctor */
    /* ------------------------------------------------------------------ */

    /**
     * Finishes a visit (FR-50…53). For a follow-up the doctor either books the slot right away
     * ($followUpStart given: $followUpDue is its date) or only says by when, and reception or the
     * patient books it later. Either way it is booked under the normal rules.
     *
     * @return array{appointment: Appointment, followUp: ?Appointment}
     */
    public function complete(
        User $actor,
        Appointment $appointment,
        ?string $followUpDue = null,
        ?string $followUpNote = null,
        ?string $followUpStart = null,
    ): array {
        if ($appointment->status !== AppointmentStatus::Confirmed) {
            throw new BookingException('invalid_transition');
        }
        // A visit is finished on its day (or later, if the doctor forgot), never ahead of it
        if ($appointment->date > CarbonImmutable::today()->format('Y-m-d')) {
            throw new BookingException('visit_not_started');
        }

        $followUp = DB::transaction(function () use ($actor, $appointment, $followUpDue, $followUpNote, $followUpStart) {
            $this->transition($appointment, AppointmentStatus::Completed, $actor, null, [
                'completed_at' => now(),
                'follow_up_due' => $followUpDue,
                'follow_up_note' => $followUpDue ? $followUpNote : null,
            ]);

            return $followUpDue && $followUpStart
                ? $this->book($actor, $appointment->doctor, $appointment->patient, $followUpDue, $followUpStart, PaymentMethod::Cash, null, $appointment)
                : null;
        });

        // A booked follow-up already told the patient its time (CONFIRMED); a request asks them to book
        $requested = $followUpDue && ! $followUp;
        $this->notify($appointment, $requested ? AppointmentNotification::FOLLOW_UP : AppointmentNotification::COMPLETED);
        if ($requested) {
            $this->alerts->send($appointment, StaffAlert::FOLLOW_UP_REQUESTED, $actor);
        }

        return ['appointment' => $appointment, 'followUp' => $followUp];
    }

    /* ------------------------------------------------------------------ */
    /* Payment callbacks */
    /* ------------------------------------------------------------------ */

    /** Called once a gateway confirms the online payment. */
    public function paymentSucceeded(Appointment $appointment): void
    {
        $appointment->update(['payment_status' => PaymentStatus::Paid]);

        if ($appointment->status === AppointmentStatus::Held) {
            $this->transition($appointment, AppointmentStatus::Confirmed, null, 'paid', [
                'hold_expires_at' => null,
                'confirmed_at' => now(),
            ]);
            $this->notify($appointment, AppointmentNotification::CONFIRMED);
            $this->alerts->send($appointment, StaffAlert::NEW_BOOKING, null);

            return;
        }

        // Paid after the 15-minute hold lapsed: revive the booking if the slot is still free, otherwise refund
        if ($appointment->status === AppointmentStatus::Cancelled && $appointment->cancel_reason === 'hold_expired') {
            try {
                $this->transition($appointment, AppointmentStatus::Confirmed, null, 'paid_late', [
                    'cancelled_at' => null,
                    'cancel_reason' => null,
                    'confirmed_at' => now(),
                ]);
                $this->notify($appointment, AppointmentNotification::CONFIRMED);
            } catch (UniqueConstraintViolationException) {
                $appointment->refresh();
                $this->payments->refund($appointment);
                $this->notify($appointment, AppointmentNotification::CANCELLED);
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /* Scheduled jobs */
    /* ------------------------------------------------------------------ */

    /** Hold timeout (15 min) and pending expiry (12 h / 6 h before) — FR-33, FR-71. */
    public function expireStale(): array
    {
        $held = Appointment::query()
            ->where('status', AppointmentStatus::Held)
            ->where('hold_expires_at', '<=', now())
            ->get()
            ->each(fn (Appointment $a) => $this->transition($a, AppointmentStatus::Cancelled, null, 'hold_expired', [
                'cancelled_at' => now(),
                'cancel_reason' => 'hold_expired',
            ]))
            ->count();

        $pending = Appointment::query()
            ->where('status', AppointmentStatus::Pending)
            ->where('pending_expires_at', '<=', now())
            ->get()
            ->each(function (Appointment $a) {
                $this->transition($a, AppointmentStatus::Cancelled, null, 'pending_expired', [
                    'cancelled_at' => now(),
                    'cancel_reason' => 'pending_expired',
                ]);
                $this->notify($a, AppointmentNotification::CANCELLED);
            })
            ->count();

        return ['held' => $held, 'pending' => $pending];
    }

    /** Reminder N hours before every confirmed appointment (FR-82). */
    public function sendReminders(): int
    {
        $now = CarbonImmutable::now();
        $until = $now->addHours(ClinicSettings::int('reminder_before_hours'));

        return Appointment::query()
            ->where('status', AppointmentStatus::Confirmed)
            ->whereNull('reminder_sent_at')
            ->whereBetween('date', [$now->format('Y-m-d'), $until->format('Y-m-d')])
            ->get()
            ->filter(fn (Appointment $a) => $a->startsAt() > $now && $a->startsAt() <= $until)
            ->each(function (Appointment $a) {
                $a->update(['reminder_sent_at' => now()]);
                $this->notify($a, AppointmentNotification::REMINDER);
            })
            ->count();
    }

    /* ------------------------------------------------------------------ */
    /* Rules */
    /* ------------------------------------------------------------------ */

    public function canPatientModify(Appointment $appointment): bool
    {
        return $appointment->status->isOpen()
            && $appointment->startsAt()->subHours(ClinicSettings::int('edit_cancel_cutoff_hours'))->isFuture();
    }

    private function assertModifiable(User $actor, Appointment $appointment): void
    {
        if (! $appointment->status->isOpen()) {
            throw new BookingException('not_cancellable');
        }
        if (! $actor->role->isStaff() && ! $this->canPatientModify($appointment)) {
            throw new BookingException('cutoff_passed');
        }
    }

    private function assertBookableDay(Doctor $doctor, CarbonImmutable $day, string $start): void
    {
        if (ClinicSettings::isWeeklyOff($day->dayOfWeek)) {
            throw new BookingException('day_off');
        }
        if (! $this->slots->isOnGrid($doctor, $day, $start)) {
            throw new BookingException('invalid_slot');
        }
        if ($this->slots->isTimeOff($doctor, $day, $start)) {
            throw new BookingException('doctor_unavailable');
        }
    }

    private function assertFollowUpFor(Appointment $parent, Doctor $doctor, Patient $patient): void
    {
        $open = Appointment::awaitingFollowUp()->whereKey($parent->id)->exists();
        if (! $open || $parent->doctor_id !== $doctor->id || $parent->patient_id !== $patient->id) {
            throw new BookingException('invalid_follow_up');
        }
    }

    /** One visit a day per patient, follow-ups included: they are booked like any other appointment. */
    private function hasConsultationOn(Patient $patient, string $date): bool
    {
        return Appointment::query()
            ->where('patient_id', $patient->id)
            ->where('date', $date)
            ->whereIn('status', AppointmentStatus::open())
            ->count() >= ClinicSettings::int('max_active_per_patient_per_day');
    }

    private function pendingCountFor(User $user): int
    {
        return Appointment::query()
            ->whereIn('patient_id', $user->patients()->select('id'))
            ->where('status', AppointmentStatus::Pending)
            ->count();
    }

    private function pendingDeadline(CarbonImmutable $startsAt): CarbonImmutable
    {
        $byAge = CarbonImmutable::now()->addHours(ClinicSettings::int('pending_expiry_hours'));
        $byStart = $startsAt->subHours(ClinicSettings::int('pending_expiry_before_appt_hours'));

        return $byAge->min($byStart);
    }

    /**
     * Inserts an appointment in a transaction that serialises bookings per doctor.
     * The unique (doctor, date, start, active_slot) index is the final guard.
     */
    private function insert(Doctor $doctor, CarbonImmutable $day, string $start, callable $fill, ?User $actor): Appointment
    {
        try {
            return DB::transaction(function () use ($doctor, $day, $start, $fill, $actor) {
                Doctor::query()->whereKey($doctor->id)->lockForUpdate()->first();

                $taken = Appointment::query()
                    ->where('doctor_id', $doctor->id)
                    ->where('date', $day->format('Y-m-d'))
                    ->where('start_time', $start)
                    ->occupying()
                    ->exists();
                if ($taken) {
                    throw new BookingException('slot_taken');
                }

                $appointment = new Appointment([
                    'doctor_id' => $doctor->id,
                    'date' => $day->format('Y-m-d'),
                    'start_time' => $start,
                    'end_time' => $day->setTimeFromTimeString($start)->addMinutes(ClinicSettings::int('slot_minutes'))->format('H:i'),
                ]);
                $fill($appointment);
                $appointment->save();
                $this->record($appointment, null, $appointment->status, $actor);

                return $appointment;
            });
        } catch (UniqueConstraintViolationException) {
            throw new BookingException('slot_taken');
        }
    }

    private function transition(Appointment $appointment, AppointmentStatus $to, ?User $by, ?string $reason = null, array $extra = []): void
    {
        $from = $appointment->status;
        $appointment->update(['status' => $to, ...$extra]);
        $this->record($appointment, $from, $to, $by, $reason);
    }

    private function record(Appointment $appointment, ?AppointmentStatus $from, AppointmentStatus $to, ?User $by, ?string $reason = null): void
    {
        $appointment->history()->create([
            'from_status' => $from,
            'to_status' => $to,
            'changed_by' => $by?->id,
            'reason' => $reason,
            'created_at' => now(),
        ]);
    }

    private function notify(Appointment $appointment, string $event): void
    {
        $appointment->patient->notify(new AppointmentNotification($appointment, $event));
    }
}
