<?php

namespace App\Providers;

use App\Models\NotificationLog;
use App\Notifications\AppointmentNotification;
use App\Services\Payments\FakeGateway;
use App\Services\Payments\MoyasarGateway;
use App\Services\Payments\PaymentGateway;
use App\Services\WhatsApp\CloudWhatsAppClient;
use App\Services\WhatsApp\LogWhatsAppClient;
use App\Services\WhatsApp\WhatsAppClient;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Notifications\Events\NotificationFailed;
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PaymentGateway::class, fn () => match (config('services.payments.driver')) {
            'moyasar' => new MoyasarGateway(config('services.moyasar')),
            default => new FakeGateway,
        });

        $this->app->singleton(WhatsAppClient::class, fn () => match (config('services.whatsapp.driver')) {
            'cloud' => new CloudWhatsAppClient(config('services.whatsapp')),
            default => new LogWhatsAppClient,
        });
    }

    public function boot(): void
    {
        // NFR-02
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)->by($request->ip().'|'.$request->input('email')));
        RateLimiter::for('booking', fn (Request $request) => Limit::perMinute(10)->by($request->user()?->id ?: $request->ip()));

        // The WhatsApp channel logs itself; record mail deliveries here
        Event::listen(NotificationSent::class, fn (NotificationSent $e) => $this->logMail($e->notification, $e->channel, 'sent'));
        Event::listen(NotificationFailed::class, fn (NotificationFailed $e) => $this->logMail($e->notification, $e->channel, 'failed'));
    }

    private function logMail(object $notification, string $channel, string $status): void
    {
        if ($channel !== 'mail' || ! $notification instanceof AppointmentNotification) {
            return;
        }
        NotificationLog::create([
            'appointment_id' => $notification->appointment->id,
            'patient_id' => $notification->appointment->patient_id,
            'channel' => 'mail',
            'event' => $notification->event,
            'locale' => $notification->appointment->patient->locale,
            'status' => $status,
            'sent_at' => $status === 'sent' ? now() : null,
        ]);
    }
}
