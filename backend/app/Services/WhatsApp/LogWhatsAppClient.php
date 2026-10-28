<?php

namespace App\Services\WhatsApp;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/** Development driver: writes the message to the log instead of calling Meta. */
class LogWhatsAppClient implements WhatsAppClient
{
    public function send(string $to, WhatsAppMessage $message): string
    {
        Log::info('WhatsApp (log driver)', ['to' => $to, ...get_object_vars($message)]);

        return 'log_'.Str::ulid();
    }
}
