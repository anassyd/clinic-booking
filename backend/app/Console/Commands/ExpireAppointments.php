<?php

namespace App\Console\Commands;

use App\Services\BookingService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('appointments:expire')]
#[Description('Cancel unpaid holds and unconfirmed cash bookings past their deadline')]
class ExpireAppointments extends Command
{
    public function handle(BookingService $booking): int
    {
        $result = $booking->expireStale();
        $this->info("Expired {$result['held']} holds and {$result['pending']} pending bookings.");

        return self::SUCCESS;
    }
}
