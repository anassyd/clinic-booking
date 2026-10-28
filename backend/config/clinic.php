<?php

/*
| Default business rules. Admins can override any key at runtime through the
| settings table (PUT /api/v1/admin/settings); see App\Support\ClinicSettings.
*/

return [
    'weekly_off_days' => [5], // Carbon dayOfWeek: 0 = Sunday … 5 = Friday
    'slot_minutes' => 30,
    'min_booking_lead_hours' => 24,
    'max_booking_days_ahead' => 30,
    'edit_cancel_cutoff_hours' => 3,
    'pending_expiry_hours' => 12,
    'pending_expiry_before_appt_hours' => 6,
    'payment_hold_minutes' => 15,
    'max_pending_per_account' => 5,
    'max_active_per_patient_per_day' => 1,
    'reminder_before_hours' => 24,
    'currency' => 'SAR',
    // VAT %, included in displayed prices. 0 until the center confirms its VAT registration.
    'vat_rate' => 0,

    'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),
];
