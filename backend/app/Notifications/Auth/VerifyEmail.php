<?php

namespace App\Notifications\Auth;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;

/**
 * Links to the SPA (/verify-email?…), which calls the API. The signature covers
 * path + query only (signed:relative) so it survives the frontend proxy / another domain.
 */
class VerifyEmail extends Notification implements ShouldQueue
{
    use Queueable;

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $relative = URL::temporarySignedRoute('verification.verify', now()->addHours(48), [
            'id' => $notifiable->getKey(),
            'hash' => sha1($notifiable->getEmailForVerification()),
        ], absolute: false);

        // /api/v1/auth/email/verify/{id}/{hash}?expires=…&signature=…  →  /verify-email?path=…
        $link = rtrim(config('clinic.frontend_url'), '/').'/verify-email?'.http_build_query(['path' => $relative]);

        return (new MailMessage)
            ->subject(__('auth_mail.verify.subject'))
            ->greeting(__('auth_mail.greeting', ['name' => $notifiable->name]))
            ->line(__('auth_mail.verify.body'))
            ->action(__('auth_mail.verify.cta'), $link)
            ->line(__('auth_mail.verify.expires'))
            ->salutation(__('notifications.signature'));
    }
}
