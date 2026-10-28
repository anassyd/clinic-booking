<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Table(name: 'doctor_time_off')]
#[Fillable(['doctor_id', 'date', 'start_time', 'end_time', 'reason'])]
class DoctorTimeOff extends Model
{
    public function doctor(): BelongsTo
    {
        return $this->belongsTo(Doctor::class);
    }

    public function isFullDay(): bool
    {
        return $this->start_time === null;
    }

    /** Does this time off cover the slot starting at $start (HH:MM)? */
    public function covers(string $start): bool
    {
        return $this->isFullDay()
            || ($start >= substr($this->start_time, 0, 5) && $start < substr($this->end_time, 0, 5));
    }
}
