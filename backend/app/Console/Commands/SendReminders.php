<?php

namespace App\Console\Commands;

use App\Services\BookingService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('appointments:remind')]
#[Description('Send WhatsApp + email reminders for appointments within the reminder window')]
class SendReminders extends Command
{
    public function handle(BookingService $booking): int
    {
        $this->info('Sent '.$booking->sendReminders().' reminders.');

        return self::SUCCESS;
    }
}
