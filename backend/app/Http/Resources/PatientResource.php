<?php

namespace App\Http\Resources;

use App\Models\Patient;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Patient */
class PatientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'userId' => $this->user_id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'nationalId' => $this->when($request->user()?->role->isStaff() || $request->user()?->id === $this->user_id, $this->national_id),
            'birthDate' => $this->birth_date->format('Y-m-d'),
            'age' => $this->age(),
            'gender' => $this->gender,
            'locale' => $this->locale,
        ];
    }
}
