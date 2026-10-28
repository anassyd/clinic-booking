<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'payments' => [
        'driver' => env('PAYMENT_DRIVER', 'fake'),
    ],

    'moyasar' => [
        'base_url' => env('MOYASAR_BASE_URL', 'https://api.moyasar.com/v1'),
        'secret_key' => env('MOYASAR_SECRET_KEY'),
        'publishable_key' => env('MOYASAR_PUBLISHABLE_KEY'),
        // Shared secret Moyasar echoes back as `secret_token` in every webhook
        'webhook_secret' => env('MOYASAR_WEBHOOK_SECRET'),
    ],

    'whatsapp' => [
        'driver' => env('WHATSAPP_DRIVER', 'log'),
        'token' => env('WHATSAPP_TOKEN'),
        'phone_number_id' => env('WHATSAPP_PHONE_NUMBER_ID'),
        'verify_token' => env('WHATSAPP_VERIFY_TOKEN'),
        'app_secret' => env('WHATSAPP_APP_SECRET'), // signs delivery webhooks
        'api_version' => env('WHATSAPP_API_VERSION', 'v21.0'),
    ],

];
