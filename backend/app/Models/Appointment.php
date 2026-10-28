<?php

namespace App\Models;

use App\Enums\AppointmentStatus;
use App\Enums\AppointmentType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

#[Fillable([
    'doctor_id', 'patient_id', 'parent_id', 'type', 'date', 'start_time', 'end_time', 'status',
    'price', 'payment_method', 'payment_status', 'hold_expires_at', 'pending_expires_at',
    'reminder_sent_at', 'booked_by', 'booked_by_role', 'confirmed_by', 'confirmed_at',
    'cancelled_by', 'cancelled_at', 'cancel_reason', 'completed_at', 'notes',
    'follow_up_due', 'follow_up_note', 'follow_up_closed_at',
])]
/**
 * `date` stays a plain Y-m-d string: a date cast would write "Y-m-d H:i:s" on SQLite and
 * break the date equality / range queries the slot logic relies on.
 */
class Appointment extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'type' => AppointmentType::class,
            'status' => AppointmentStatus::class,
            'payment_method' => PaymentMethod::class,
            'payment_status' => PaymentStatus::class,
            'booked_by_role' => Role::class,
            'hold_expires_at' => 'datetime',
            'pending_expires_at' => 'datetime',
            'reminder_sent_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'completed_at' => 'datetime',
            'follow_up_closed_at' => 'datetime',
        ];
    }

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(Doctor::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function followUps(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function latestPayment(): HasOne
    {
        return $this->hasOne(Payment::class)->latestOfMany();
    }

    public function history(): HasMany
    {
        return $this->hasMany(AppointmentStatusHistory::class);
    }

    public function startsAt(): Carbon
    {
        return Carbon::parse($this->date.' '.$this->start_time);
    }

    /**
     * Visits whose doctor asked for a follow-up that nobody has booked yet (a cancelled
     * follow-up reopens the request) and reception hasn't dismissed.
     *
     * @param  Builder<self>  $query
     */
    public function scopeAwaitingFollowUp(Builder $query): void
    {
        $query->where('status', AppointmentStatus::Completed)
            ->whereNotNull('follow_up_due')
            ->whereNull('follow_up_closed_at')
            ->whereDoesntHave('followUps', fn (Builder $q) => $q->where('status', '!=', AppointmentStatus::Cancelled));
    }

    /** @param Builder<self> $query */
    public function scopeOccupying(Builder $query): void
    {
        $query->whereIn('status', AppointmentStatus::occupying());
    }
}
