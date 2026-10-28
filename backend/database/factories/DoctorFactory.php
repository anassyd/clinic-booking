<?php

namespace Database\Factories;

use App\Models\Doctor;
use App\Models\Specialty;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Doctor> */
class DoctorFactory extends Factory
{
    public function definition(): array
    {
        return [
            'specialty_id' => Specialty::factory(),
            'name' => ['ar' => 'د. '.fake()->firstName(), 'en' => 'Dr. '.fake()->firstName()],
            'title' => ['ar' => 'أخصائي', 'en' => 'Specialist'],
            'consultation_price' => 300,
            'follow_up_price' => 0,
        ];
    }

    /** Works 09:00–17:00 Saturday → Thursday. */
    public function withSchedule(string $start = '09:00', string $end = '17:00'): static
    {
        return $this->afterCreating(function (Doctor $doctor) use ($start, $end) {
            foreach ([6, 0, 1, 2, 3, 4] as $day) {
                $doctor->schedules()->create(['day_of_week' => $day, 'start_time' => $start, 'end_time' => $end]);
            }
        });
    }
}
