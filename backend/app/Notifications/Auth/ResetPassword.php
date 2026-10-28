<?php

namespace App\Notifications\Auth;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPassword extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $token) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $link = rtrim(config('clinic.frontend_url'), '/').'/reset-password?'.http_build_query([
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]);

        return (new MailMessage)
            ->subject(__('auth_mail.reset.subject'))
            ->greeting(__('auth_mail.greeting', ['name' => $notifiable->name]))
            ->line(__('auth_mail.reset.body'))
            ->action(__('auth_mail.reset.cta'), $link)
            ->line(__('auth_mail.reset.expires', ['minutes' => config('auth.passwords.users.expire')]))
            ->line(__('auth_mail.reset.ignore'))
            ->salutation(__('notifications.signature'));
    }
}
