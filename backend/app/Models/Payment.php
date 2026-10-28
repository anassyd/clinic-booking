<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Enums\TransactionStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'appointment_id', 'method', 'amount', 'currency', 'status', 'gateway', 'gateway_order_id',
    'gateway_txn_id', 'raw_payload', 'paid_at', 'refunded_at', 'refund_error', 'refund_attempts', 'refund_failed_at',
    'received_by', 'reference',
])]
class Payment extends Model
{
    protected function casts(): array
    {
        return [
            'method' => PaymentMethod::class,
            'status' => TransactionStatus::class,
            'raw_payload' => 'array',
            'paid_at' => 'datetime',
            'refunded_at' => 'datetime',
            'refund_failed_at' => 'datetime',
        ];
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }
}
