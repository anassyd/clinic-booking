<?php

namespace App\Http\Requests;

use App\Enums\PaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Money taken at reception: the method, plus the transfer number (required) or POS receipt number (optional). */
class DeskPaymentRequest extends FormRequest
{
    public function rules(): array
    {
        return self::deskRules();
    }

    /** @return array<string, list<mixed>> */
    public static function deskRules(string $prefix = ''): array
    {
        return [
            // Nested (quick booking): only when a `payment` object is sent
            "{$prefix}method" => [$prefix ? 'required_with:'.rtrim($prefix, '.') : 'required', Rule::enum(PaymentMethod::class)->only(PaymentMethod::desk())],
            "{$prefix}reference" => ['nullable', "required_if:{$prefix}method,".PaymentMethod::Transfer->value, 'string', 'max:100'],
        ];
    }
}
