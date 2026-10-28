<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Enums\Role;
use App\Models\Appointment;
use App\Notifications\AppointmentNotification;
use App\Notifications\Channels\WhatsAppChannel;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;

class SchedulerTest extends BookingTestCase
{
    public function test_unconfirmed_cash_bookings_expire_and_the_patient_is_told(): void
    {
        $this->actingAsPatient();
        $id = $this->book()->json('data.id'); // expires 22:00 tonight

        Carbon::setTestNow('2026-10-26 21:59:00');
        $this->artisan('appointments:expire');
        $this->assertSame(AppointmentStatus::Pending, Appointment::find($id)->status);

        Carbon::setTestNow('2026-10-26 22:00:00');
        $this->artisan('appointments:expire')->expectsOutputToContain('1 pending');
        $appt = Appointment::find($id);
        $this->assertSame(AppointmentStatus::Cancelled, $appt->status);
        $this->assertSame('pending_expired', $appt->cancel_reason);
        Notification::assertSentTo($this->patient, AppointmentNotification::class, fn ($n) => $n->event === AppointmentNotification::CANCELLED);
    }

    public function test_reminders_go_out_once_within_24_hours(): void
    {
        $this->actingAsRole(Role::Receptionist);
        $this->book(['date' => '2026-10-27', 'start' => '09:00'])->assertCreated(); // 23 h away
        $this->book(['patient_id' => $this->familyMember($this->patientUser)->id, 'date' => '2026-10-28', 'start' => '09:00'])->assertCreated();

        $this->artisan('appointments:remind')->expectsOutputToContain('Sent 1 reminders');
        $this->artisan('appointments:remind')->expectsOutputToContain('Sent 0 reminders');

        Notification::assertSentToTimes($this->patient, AppointmentNotification::class, 2); // confirmed + reminder
    }

    public function test_notifications_go_by_mail_and_whatsapp_in_the_patients_language(): void
    {
        if (! extension_loaded('intl')) {
            $this->markTestSkipped('Hijri dates need the PHP intl extension.');
        }
        $this->patient->update(['locale' => 'en', 'phone' => '0598765432']);
        $this->actingAsPatient();
        $this->book()->assertCreated();

        Notification::assertSentTo($this->patient, AppointmentNotification::class, function (AppointmentNotification $n, array $channels) {
            $message = $n->toWhatsApp($this->patient);

            return $channels === ['mail', WhatsAppChannel::class]
                && $message->template === 'appointment_pending'
                && $message->language === 'en'
                && str_starts_with($message->parameters[2], 'Tuesday 27 October 2026 (')
                && str_contains($message->parameters[2], '1448 AH')
                && $message->parameters[3] === '12:00 PM'
                && $this->patient->routeNotificationForWhatsapp() === '966598765432';
        });
    }

    public function test_messages_still_format_their_dates(): void
    {
        $this->actingAsPatient();
        $this->book()->assertCreated();

        // With or without intl, the date parameter is always there (Hijri is added when intl is available)
        Notification::assertSentTo($this->patient, AppointmentNotification::class, fn (AppointmentNotification $n) => str_contains($n->toWhatsApp($this->patient)->parameters[2], '2026'));
    }
}
