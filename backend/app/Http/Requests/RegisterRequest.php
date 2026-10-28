<?php

namespace App\Http\Requests;

use App\Enums\Gender;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'phone' => ['required', 'regex:'.StorePatientRequest::PHONE],
            'password' => ['required', Password::min(8)],
            'gender' => ['sometimes', 'nullable', Rule::enum(Gender::class)],
            'locale' => ['sometimes', 'in:ar,en'],
        ];
    }
}
