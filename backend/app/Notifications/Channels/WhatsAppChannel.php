<?php

namespace App\Notifications\Channels;

use App\Models\NotificationLog;
use App\Notifications\AppointmentNotification;
use App\Services\WhatsApp\WhatsAppClient;
use Illuminate\Notifications\Notification;
use Throwable;

class WhatsAppChannel
{
    public function __construct(private readonly WhatsAppClient $client) {}

    public function send(object $notifiable, Notification $notification): void
    {
        if (! $notification instanceof AppointmentNotification) {
            return;
        }
        $to = $notifiable->routeNotificationFor('whatsapp', $notification);
        if (! $to) {
            return;
        }

        $message = $notification->toWhatsApp($notifiable);
        $log = [
            'appointment_id' => $notification->appointment->id,
            'patient_id' => $notification->appointment->patient_id,
            'channel' => 'whatsapp',
            'event' => $notification->event,
            'locale' => $message->language,
        ];

        try {
            $id = $this->client->send($to, $message);
            NotificationLog::create([...$log, 'status' => 'sent', 'provider_message_id' => $id, 'sent_at' => now()]);
        } catch (Throwable $e) {
            NotificationLog::create([...$log, 'status' => 'failed', 'error' => $e->getMessage()]);

            throw $e; // let the queue retry (NFR-10)
        }
    }
}
