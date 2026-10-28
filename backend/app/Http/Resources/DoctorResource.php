<?php

namespace App\Http\Resources;

use App\Models\Doctor;
use App\Models\DoctorSchedule;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Doctor */
class DoctorResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'specialtyId' => $this->specialty_id,
            'userId' => $this->when($request->user()?->role->isStaff(), $this->user_id),
            'name' => $this->name,
            'title' => $this->title,
            'bio' => $this->bio,
            'photo' => $this->photo,
            'yearsOfExperience' => $this->years_of_experience,
            'rating' => $this->rating,
            'consultationPrice' => $this->consultation_price,
            'followUpPrice' => $this->follow_up_price,
            'isActive' => $this->is_active,
            'schedules' => $this->whenLoaded('schedules', fn () => $this->schedules
                ->sortBy('day_of_week')
                ->map(fn (DoctorSchedule $s) => ['dayOfWeek' => $s->day_of_week, 'start' => $s->start(), 'end' => $s->end()])
                ->values()),
            'specialty' => new SpecialtyResource($this->whenLoaded('specialty')),
        ];
    }
}
