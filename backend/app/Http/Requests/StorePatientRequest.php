<?php

namespace App\Http\Requests;

use App\Enums\Gender;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePatientRequest extends FormRequest
{
    /** Saudi mobile in local format: 05XXXXXXXX. */
    public const PHONE = '/^05\d{8}$/';

    /** National ID (starts with 1) or Iqama (starts with 2): 10 digits. */
    public const NATIONAL_ID = '/^[12]\d{9}$/';

    public function rules(): array
    {
        return self::patientRules();
    }

    public static function patientRules(string $prefix = ''): array
    {
        return [
            "{$prefix}name" => ['required', 'string', 'min:3', 'max:120'],
            "{$prefix}email" => ['required', 'email', 'max:190'],
            "{$prefix}phone" => ['required', 'regex:'.self::PHONE],
            "{$prefix}birth_date" => ['required', 'date', 'before:today', 'after:1900-01-01'],
            "{$prefix}gender" => ['required', Rule::enum(Gender::class)],
            "{$prefix}national_id" => ['nullable', 'regex:'.self::NATIONAL_ID],
            "{$prefix}locale" => ['sometimes', 'in:ar,en'],
        ];
    }
}
