<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** date + start for a reschedule. */
class SlotRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'date' => ['required', 'date_format:Y-m-d'],
            'start' => ['required', 'date_format:H:i'],
        ];
    }
}
