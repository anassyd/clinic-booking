<?php

namespace App\Enums;

/**
 * How an appointment is (or will be) paid. A patient chooses online or "cash" (= at the clinic);
 * reception records the actual desk method — cash, mada/card on the POS, or bank transfer — when it collects.
 */
enum PaymentMethod: string
{
    case Online = 'online';
    case Cash = 'cash';
    case Card = 'card';
    case Transfer = 'transfer';

    /** @return list<self> the methods reception can collect with */
    public static function desk(): array
    {
        return [self::Cash, self::Card, self::Transfer];
    }

    public function isDesk(): bool
    {
        return $this !== self::Online;
    }
}
