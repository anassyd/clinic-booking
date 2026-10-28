<?php

namespace App\Services\WhatsApp;

interface WhatsAppClient
{
    /** Sends a template message and returns the provider message id. */
    public function send(string $to, WhatsAppMessage $message): string;
}
