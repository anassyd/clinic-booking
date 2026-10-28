<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

/**
 * Business rules from config/clinic.php, overridable by admins at runtime.
 */
class ClinicSettings
{
    private const CACHE_KEY = 'clinic.settings';

    /** Keys admins may change through the API. */
    public const EDITABLE = [
        'weekly_off_days', 'min_booking_lead_hours', 'max_booking_days_ahead',
        'edit_cancel_cutoff_hours', 'pending_expiry_hours', 'pending_expiry_before_appt_hours',
        'payment_hold_minutes', 'max_pending_per_account', 'max_active_per_patient_per_day',
        'reminder_before_hours', 'vat_rate',
    ];

    public static function all(): array
    {
        $overrides = Cache::rememberForever(
            self::CACHE_KEY,
            fn () => Setting::query()->pluck('value', 'key')->all(),
        );

        return array_merge(config('clinic'), $overrides);
    }

    public static function get(string $key): mixed
    {
        return self::all()[$key] ?? null;
    }

    public static function int(string $key): int
    {
        return (int) self::get($key);
    }

    public static function update(array $values): array
    {
        foreach ($values as $key => $value) {
            Setting::query()->updateOrCreate(['key' => $key], ['value' => $value]);
        }
        Cache::forget(self::CACHE_KEY);

        return self::all();
    }

    /** VAT contained in a VAT-inclusive price, rounded to halalas. */
    public static function vatPortion(int $price): float
    {
        $rate = (float) self::get('vat_rate');

        return $rate > 0 ? round($price - $price / (1 + $rate / 100), 2) : 0.0;
    }

    public static function isWeeklyOff(int $dayOfWeek): bool
    {
        return in_array($dayOfWeek, (array) self::get('weekly_off_days'), true);
    }
}
