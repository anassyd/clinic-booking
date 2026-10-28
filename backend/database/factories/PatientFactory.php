<?php

namespace Database\Factories;

use App\Enums\Gender;
use App\Models\Patient;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Patient> */
class PatientFactory extends Factory
{
    private const FIRST_M = ['عبدالله', 'محمد', 'فهد', 'سعود', 'خالد', 'فيصل', 'عبدالرحمن', 'سلطان', 'تركي', 'ناصر', 'بندر', 'ماجد'];

    private const FIRST_F = ['نورة', 'سارة', 'ريم', 'هيفاء', 'لمى', 'العنود', 'منيرة', 'شهد', 'جواهر', 'أمل', 'دانة', 'غادة'];

    private const LAST = ['العتيبي', 'القحطاني', 'الشهري', 'الغامدي', 'الزهراني', 'الدوسري', 'الحربي', 'المطيري', 'السبيعي', 'الشمري', 'العنزي', 'المالكي'];

    public function definition(): array
    {
        $gender = fake()->randomElement(Gender::cases());

        return [
            'name' => fake()->randomElement($gender === Gender::Female ? self::FIRST_F : self::FIRST_M).' '.fake()->randomElement(self::LAST),
            'email' => fake()->unique()->safeEmail(),
            'phone' => '05'.fake()->numerify('########'),
            'national_id' => fake()->optional(0.7)->numerify(fake()->randomElement(['1', '2']).'#########'),
            'birth_date' => fake()->dateTimeBetween('-80 years', '-1 year')->format('Y-m-d'),
            'gender' => $gender,
            'locale' => 'ar',
        ];
    }
}
