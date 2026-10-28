<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Reason is optional for patients and required for staff (FR-45). */
class CancelRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'reason' => [$this->user()->role->isStaff() ? 'required' : 'nullable', 'string', 'max:255'],
        ];
    }
}
