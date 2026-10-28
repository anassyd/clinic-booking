<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Table(timestamps: false)]
#[Fillable(['doctor_id', 'day_of_week', 'start_time', 'end_time'])]
class DoctorSchedule extends Model
{
    public function doctor(): BelongsTo
    {
        return $this->belongsTo(Doctor::class);
    }

    /** "09:00:00" → "09:00" */
    public function start(): string
    {
        return substr($this->start_time, 0, 5);
    }

    public function end(): string
    {
        return substr($this->end_time, 0, 5);
    }
}
