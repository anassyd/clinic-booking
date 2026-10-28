<?php

return [
    'errors' => [
        'email_unverified' => 'Confirm your email before booking. Check your inbox for the link.',
        'invalid_verification_link' => 'This confirmation link is invalid or has expired.',
        'invalid_reset_token' => 'This reset link is invalid or has expired. Request a new one.',
        'slot_taken' => 'That slot was just taken. Please pick another.',
        'daily_limit_reached' => 'This patient already has a booking on that day.',
        'lead_time_violation' => 'Bookings must be made at least 24 hours ahead.',
        'too_far_ahead' => 'You can book up to 30 days ahead.',
        'cutoff_passed' => 'Changes are not allowed within 3 hours of the appointment.',
        'pending_limit_reached' => 'You have 5 bookings awaiting confirmation. Wait for them or pay online.',
        'day_off' => 'The center is closed on that day.',
        'doctor_unavailable' => 'The doctor is not available at that time.',
        'invalid_slot' => 'That time is not one of the doctor\'s slots.',
        'slot_in_past' => 'That time has already passed.',
        'not_cancellable' => 'This appointment can no longer be changed.',
        'invalid_transition' => 'This action is not allowed for the appointment\'s current status.',
        'invalid_follow_up' => 'This follow-up request is no longer open or was already booked.',
        'visit_not_started' => "This visit hasn't started yet.",
        'payment_not_required' => 'This appointment does not need an online payment.',
        'invalid_credentials' => 'Wrong email or password.',
        'account_disabled' => 'This account is disabled.',
    ],
];
