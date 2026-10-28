<?php

namespace App\Models;

use App\Enums\Gender;
use Illuminate\Contracts\Translation\HasLocalePreference;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Notifications\Notifiable;

/** The person being treated; may or may not own an account (see SRS §6). */
#[Fillable(['user_id', 'name', 'email', 'phone', 'national_id', 'birth_date', 'gender', 'locale', 'created_by'])]
class Patient extends Model implements HasLocalePreference
{
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'birth_date' => 'date:Y-m-d',
            'gender' => Gender::class,
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }

    public function age(): int
    {
        return (int) $this->birth_date->diffInYears(now());
    }

    public function preferredLocale(): string
    {
        // A model created in this request hasn't loaded the column's DB default yet
        return $this->locale ?? config('app.locale');
    }

    /** 05XXXXXXXX → 9665XXXXXXXX (E.164 without "+"), as the WhatsApp Cloud API expects. */
    public function routeNotificationForWhatsapp(): string
    {
        return '966'.substr($this->phone, 1);
    }
}
