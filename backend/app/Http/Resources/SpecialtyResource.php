<?php

namespace App\Http\Resources;

use App\Models\Specialty;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Specialty */
class SpecialtyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'description' => $this->description,
            'icon' => $this->icon,
            'isActive' => $this->is_active,
            'doctorsCount' => $this->whenCounted('doctors'),
        ];
    }
}
