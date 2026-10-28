<?php

return [
    'greeting' => 'Hello :name,',
    'verify' => [
        'subject' => 'Confirm your email',
        'body' => 'Thanks for registering with Shifaa Medical Center. Confirm your email to start booking.',
        'cta' => 'Confirm email',
        'expires' => 'This link expires in 48 hours.',
    ],
    'reset' => [
        'subject' => 'Reset your password',
        'body' => 'We received a request to reset the password for your account.',
        'cta' => 'Choose a new password',
        'expires' => 'This link expires in :minutes minutes.',
        'ignore' => "If you didn't ask for this, ignore this email — nothing will change.",
    ],
];
