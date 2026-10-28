<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case Unpaid = 'unpaid';
    case Paid = 'paid';
    case Refunded = 'refunded';
    /** Cancelled, but the gateway refund failed — waiting for an admin retry. */
    case RefundPending = 'refund_pending';
}
