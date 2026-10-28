<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'appointment_id', 'patient_id', 'channel', 'event', 'locale', 'status',
    'provider_message_id', 'error', 'sent_at',
])]
class NotificationLog extends Model
{
    protected function casts(): array
    {
        return ['sent_at' => 'datetime'];
    }
}
