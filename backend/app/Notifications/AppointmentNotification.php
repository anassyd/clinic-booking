<?php

namespace App\Notifications;

use App\Models\Appointment;
use App\Notifications\Channels\WhatsAppChannel;
use App\Services\WhatsApp\WhatsAppMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;
use IntlDateFormatter;

/**
 * One notification class for every appointment event (SRS §3.9). Each event maps to a
 * mail body in lang/{ar,en}/notifications.php and a WhatsApp template of the same name.
 */
class AppointmentNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public const PENDING = 'appointment_pending';

    public const CONFIRMED = 'appointment_confirmed';

    public const REMINDER = 'appointment_reminder';

    public const RESCHEDULED = 'appointment_rescheduled';

    public const CANCELLED = 'appointment_cancelled';

    public const COMPLETED = 'visit_completed';

    /** The doctor asked for a follow-up by a date; the patient or reception books it. */
    public const FOLLOW_UP = 'follow_up_requested';

    public int $tries = 3;

    public array $backoff = [60, 300, 900];

    public function __construct(public Appointment $appointment, public string $event)
    {
        $this->afterCommit();
    }

    public function via(object $notifiable): array
    {
        return ['mail', WhatsAppChannel::class];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $vars = $this->variables($notifiable);

        return (new MailMessage)
            ->subject(__("notifications.{$this->event}.subject", $vars))
            ->greeting(__('notifications.greeting', $vars))
            ->line(__("notifications.{$this->event}.body", $vars))
            ->lineIf($this->event !== self::FOLLOW_UP, __('notifications.details', $vars))
            ->action(__('notifications.cta'), rtrim(config('clinic.frontend_url'), '/').'/my')
            ->salutation(__('notifications.signature'));
    }

    public function toWhatsApp(object $notifiable): WhatsAppMessage
    {
        $vars = $this->variables($notifiable);

        return new WhatsAppMessage(
            template: $this->event,
            language: $notifiable->preferredLocale(),
            parameters: $this->event === self::FOLLOW_UP
                ? [$vars['patient'], $vars['doctor'], $vars['due']]
                : [$vars['patient'], $vars['doctor'], $vars['date'], $vars['time']],
        );
    }

    /** @return array<string, string> */
    private function variables(object $notifiable): array
    {
        $locale = $notifiable->preferredLocale();
        $a = $this->appointment->loadMissing('doctor', 'patient');
        $start = $a->startsAt()->locale($locale);

        return [
            'patient' => $a->patient->name,
            'doctor' => $a->doctor->name[$locale] ?? $a->doctor->name['ar'],
            'date' => $this->bothCalendars($start, $locale),
            'time' => $start->isoFormat('h:mm A'),
            'due' => $a->follow_up_due ? $this->bothCalendars(Carbon::parse($a->follow_up_due)->locale($locale), $locale) : '',
            'price' => (string) $a->price,
        ];
    }

    /** Saudi patients read both calendars: "الثلاثاء 27 أكتوبر 2026 (16 جمادى الأولى 1448 هـ)" */
    private function bothCalendars(Carbon $day, string $locale): string
    {
        $gregorian = $day->isoFormat('dddd D MMMM YYYY');
        // Without PHP's intl extension there is no Umm al-Qura calendar: send the Gregorian date rather than fail
        if (! class_exists(IntlDateFormatter::class)) {
            return $gregorian;
        }

        $hijri = (new IntlDateFormatter(
            "{$locale}@calendar=islamic-umalqura",
            IntlDateFormatter::LONG,
            IntlDateFormatter::NONE,
            config('app.timezone'),
            IntlDateFormatter::TRADITIONAL,
        ))->format($day->toDateTime());

        return "{$gregorian} ({$hijri})";
    }
}
