<?php

namespace Database\Factories;

use App\Models\Specialty;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Specialty> */
class SpecialtyFactory extends Factory
{
    public function definition(): array
    {
        $slug = fake()->unique()->slug(2);

        return ['slug' => $slug, 'name' => ['ar' => $slug, 'en' => $slug], 'description' => null];
    }
}
