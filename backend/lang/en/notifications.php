<?php

return [
    'greeting' => 'Hello :patient,',
    'details' => 'Doctor: :doctor — :date at :time',
    'cta' => 'View my appointments',
    'signature' => 'Shifaa Medical Center',

    'appointment_pending' => [
        'subject' => 'Booking received — awaiting confirmation',
        'body' => 'We received your booking. Reception will confirm it shortly.',
    ],
    'appointment_confirmed' => [
        'subject' => 'Your appointment is confirmed',
        'body' => 'Your appointment is confirmed. See you soon!',
    ],
    'appointment_reminder' => [
        'subject' => 'Reminder: your appointment is tomorrow',
        'body' => 'This is a reminder of your upcoming appointment.',
    ],
    'appointment_rescheduled' => [
        'subject' => 'Your appointment was rescheduled',
        'body' => 'Your appointment has a new time.',
    ],
    'appointment_cancelled' => [
        'subject' => 'Your appointment was cancelled',
        'body' => 'Your appointment was cancelled. Any online payment is refunded in full.',
    ],
    'visit_completed' => [
        'subject' => 'Thank you for your visit',
        'body' => 'Your visit is complete. We wish you good health.',
    ],
    'follow_up_requested' => [
        'subject' => 'Your doctor asked for a follow-up',
        'body' => 'Your visit with :doctor is complete, and the doctor would like to see you again by :due. Book the follow-up from your account, or reception will contact you to arrange it.',
    ],
];
