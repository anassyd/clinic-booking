<?php

namespace App\Enums;

/** Status of a single gateway transaction (payments table). */
enum TransactionStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Failed = 'failed';
    case Refunded = 'refunded';
}
