<?php

namespace Database\Seeders;

use App\Models\Doctor;
use App\Models\Specialty;
use Illuminate\Database\Seeder;

/** 5 specialties × 2 doctors — same data the frontend demo uses. */
class CatalogSeeder extends Seeder
{
    /** Saturday → Thursday (Carbon dayOfWeek); Friday is the weekly day off. */
    private const WORK_DAYS = [6, 0, 1, 2, 3, 4];

    private const MORNING = ['09:00', '17:00'];

    private const EVENING = ['14:00', '22:00'];

    public function run(): void
    {
        $specialties = [
            ['internal-medicine', 'stethoscope', 'الباطنة', 'Internal Medicine', 'تشخيص وعلاج أمراض الجهاز الهضمي والسكر والضغط.', 'Diagnosis and care for digestive, diabetes and blood-pressure conditions.'],
            ['pediatrics', 'baby', 'الأطفال', 'Pediatrics', 'متابعة نمو الأطفال والتطعيمات وعلاج أمراض الطفولة.', 'Growth follow-up, vaccinations and childhood illnesses.'],
            ['obgyn', 'heart-pulse', 'النساء والتوليد', 'Obstetrics & Gynecology', 'متابعة الحمل وصحة المرأة في كل المراحل.', "Pregnancy follow-up and women's health at every stage."],
            ['orthopedics', 'bone', 'العظام', 'Orthopedics', 'علاج الكسور وآلام المفاصل والعمود الفقري.', 'Fractures, joint pain and spine care.'],
            ['dermatology', 'sparkles', 'الجلدية', 'Dermatology', 'علاج أمراض الجلد والشعر والأظافر.', 'Skin, hair and nail conditions.'],
        ];
        foreach ($specialties as [$slug, $icon, $ar, $en, $descAr, $descEn]) {
            Specialty::create([
                'slug' => $slug,
                'icon' => $icon,
                'name' => ['ar' => $ar, 'en' => $en],
                'description' => ['ar' => $descAr, 'en' => $descEn],
            ]);
        }

        $doctors = [
            // specialty, ar name, en name, ar title, en title, ar bio, en bio, years, rating, price, follow-up, shift
            [1, 'د. أحمد منصور', 'Dr. Ahmed Mansour', 'استشاري الباطنة', 'Consultant, Internal Medicine', 'خبرة في أمراض الجهاز الهضمي والكبد ومتابعة مرضى السكر.', 'Focused on gastroenterology, liver disease and diabetes care.', 18, 4.9, 350, 0, self::MORNING],
            [1, 'د. سارة الشريف', 'Dr. Sara El-Sherif', 'أخصائي الباطنة', 'Specialist, Internal Medicine', 'متابعة الضغط والغدد الصماء وأمراض القلب الوقائية.', 'Hypertension, endocrinology and preventive cardiology.', 9, 4.8, 250, 100, self::EVENING],
            [2, 'د. محمد القحطاني', 'Dr. Mohammed Al-Qahtani', 'استشاري طب الأطفال', 'Consultant, Pediatrics', 'حديثي الولادة والتغذية ومتابعة النمو.', 'Neonatal care, nutrition and growth monitoring.', 21, 4.9, 350, 0, self::MORNING],
            [2, 'د. منى الغامدي', 'Dr. Mona Al-Ghamdi', 'أخصائي طب الأطفال', 'Specialist, Pediatrics', 'حساسية الصدر عند الأطفال والتطعيمات.', 'Pediatric asthma, allergies and vaccinations.', 11, 4.7, 250, 100, self::EVENING],
            [3, 'د. هالة الزهراني', 'Dr. Hala Al-Zahrani', 'استشاري النساء والتوليد', 'Consultant, OB/GYN', 'متابعة الحمل عالي الخطورة والسونار رباعي الأبعاد.', 'High-risk pregnancy follow-up and 4D ultrasound.', 20, 4.9, 400, 150, self::MORNING],
            [3, 'د. ياسمين عادل', 'Dr. Yasmine Adel', 'أخصائي النساء والتوليد', 'Specialist, OB/GYN', 'صحة المرأة وتأخر الإنجاب.', "Women's health and fertility.", 8, 4.6, 250, 100, self::EVENING],
            [4, 'د. كريم حسان', 'Dr. Karim Hassan', 'استشاري جراحة العظام', 'Consultant, Orthopedic Surgery', 'إصابات الملاعب ومناظير الركبة والكتف.', 'Sports injuries, knee and shoulder arthroscopy.', 16, 4.8, 350, 0, self::MORNING],
            [4, 'د. عمر الدوسري', 'Dr. Omar Al-Dosari', 'أخصائي العظام', 'Specialist, Orthopedics', 'آلام العمود الفقري وخشونة المفاصل.', 'Spine pain and osteoarthritis.', 10, 4.7, 250, 100, self::EVENING],
            [5, 'د. نادين سمير', 'Dr. Nadine Samir', 'استشاري الجلدية', 'Consultant, Dermatology', 'حب الشباب والأمراض المزمنة والليزر.', 'Acne, chronic skin disease and laser treatments.', 14, 4.8, 350, 0, self::MORNING],
            [5, 'د. فيصل الحربي', 'Dr. Faisal Al-Harbi', 'أخصائي الجلدية', 'Specialist, Dermatology', 'تساقط الشعر وأمراض الجلد عند الأطفال.', 'Hair loss and pediatric dermatology.', 7, 4.6, 250, 100, self::EVENING],
        ];
        foreach ($doctors as [$specialty, $ar, $en, $titleAr, $titleEn, $bioAr, $bioEn, $years, $rating, $price, $followUp, [$start, $end]]) {
            $doctor = Doctor::create([
                'specialty_id' => $specialty,
                'name' => ['ar' => $ar, 'en' => $en],
                'title' => ['ar' => $titleAr, 'en' => $titleEn],
                'bio' => ['ar' => $bioAr, 'en' => $bioEn],
                'years_of_experience' => $years,
                'rating' => $rating,
                'consultation_price' => $price,
                'follow_up_price' => $followUp,
            ]);
            foreach (self::WORK_DAYS as $day) {
                $doctor->schedules()->create(['day_of_week' => $day, 'start_time' => $start, 'end_time' => $end]);
            }
        }
    }
}
