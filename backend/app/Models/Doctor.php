<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'user_id', 'specialty_id', 'name', 'title', 'bio', 'photo', 'years_of_experience',
    'rating', 'consultation_price', 'follow_up_price', 'is_active',
])]
class Doctor extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'name' => 'array',
            'title' => 'array',
            'bio' => 'array',
            'rating' => 'float',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function specialty(): BelongsTo
    {
        return $this->belongsTo(Specialty::class);
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(DoctorSchedule::class);
    }

    public function timeOff(): HasMany
    {
        return $this->hasMany(DoctorTimeOff::class);
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }

    public function scheduleFor(int $dayOfWeek): ?DoctorSchedule
    {
        return $this->schedules->firstWhere('day_of_week', $dayOfWeek);
    }
}
