<?php

namespace Database\Seeders;

use App\Enums\AppointmentStatus;
use App\Enums\AppointmentType;
use App\Enums\Gender;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\TransactionStatus;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\Patient;
use App\Models\User;
use App\Services\SlotService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * Demo accounts (password: "password") and ~6 weeks of realistic bookings.
 * Not run in production: `php artisan db:seed` only runs CatalogSeeder there.
 */
class DemoSeeder extends Seeder
{
    public function run(SlotService $slots): void
    {
        $patientUser = User::create(['name' => 'نورة العتيبي', 'email' => 'patient@demo.test', 'phone' => '0501234567', 'password' => 'password', 'role' => Role::Patient, 'gender' => Gender::Female]);
        $reception = User::create(['name' => 'ريم الشهري', 'email' => 'staff@demo.test', 'phone' => '0551234567', 'password' => 'password', 'role' => Role::Receptionist, 'gender' => Gender::Female]);
        User::create(['name' => 'إدارة المركز', 'email' => 'admin@demo.test', 'phone' => '0561234567', 'password' => 'password', 'role' => Role::Admin]);

        // One login per doctor: doctor1@demo.test … doctor10@demo.test
        $femaleDoctors = [2, 4, 5, 6, 9]; // see CatalogSeeder; drives the avatar illustration
        Doctor::all()->each(function (Doctor $doctor) use ($femaleDoctors) {
            $user = User::create([
                'name' => $doctor->name['ar'],
                'email' => $doctor->id === 1 ? 'doctor@demo.test' : "doctor{$doctor->id}@demo.test",
                'password' => 'password',
                'role' => Role::Doctor,
                'gender' => in_array($doctor->id, $femaleDoctors, true) ? Gender::Female : Gender::Male,
            ]);
            $doctor->update(['user_id' => $user->id]);
        });

        $family = [
            Patient::create(['user_id' => $patientUser->id, 'name' => 'نورة العتيبي', 'email' => 'patient@demo.test', 'phone' => '0501234567', 'national_id' => '1012345678', 'birth_date' => '1994-03-12', 'gender' => Gender::Female]),
            Patient::create(['user_id' => $patientUser->id, 'name' => 'عبدالله العتيبي', 'email' => 'patient@demo.test', 'phone' => '0501234567', 'birth_date' => '2019-07-02', 'gender' => Gender::Male]),
        ];
        $crowd = Patient::factory()->count(160)->create();

        mt_srand(42);
        $today = CarbonImmutable::today();
        $now = CarbonImmutable::now();
        $bookedOn = []; // "patient|date" — keep the one-per-day rule true in seed data

        foreach (Doctor::with('schedules')->get() as $doctor) {
            for ($offset = -21; $offset <= 21; $offset++) {
                $day = $today->addDays($offset);
                $schedule = $doctor->scheduleFor($day->dayOfWeek);
                if (! $schedule || $day->dayOfWeek === CarbonImmutable::FRIDAY) {
                    continue;
                }
                $load = $offset < 0 ? 0.6 : ($offset < 4 ? 0.7 : ($offset < 10 ? 0.45 : 0.2));

                foreach ($slots->slotTimes($schedule->start_time, $schedule->end_time) as $slot) {
                    if (mt_rand() / mt_getrandmax() > $load) {
                        continue;
                    }
                    $patient = $crowd->random();
                    $key = $patient->id.'|'.$day->format('Y-m-d');
                    if (isset($bookedOn[$key])) {
                        continue;
                    }
                    $bookedOn[$key] = true;

                    $startsAt = $day->setTimeFromTimeString($slot['start']);
                    $roll = mt_rand(1, 100);
                    $status = match (true) {
                        $startsAt < $now => $roll <= 85 ? AppointmentStatus::Completed : AppointmentStatus::NoShow,
                        $offset >= 1 && $offset <= 5 && $roll <= 4 => AppointmentStatus::Pending,
                        default => AppointmentStatus::Confirmed,
                    };
                    $followUp = mt_rand(1, 100) <= 15;
                    $method = mt_rand(1, 100) <= 55 ? PaymentMethod::Online : PaymentMethod::Cash;
                    $paid = $method === PaymentMethod::Online || $status === AppointmentStatus::Completed;
                    if ($paid && $method === PaymentMethod::Cash) {
                        // Collected at the desk: mostly cash or mada on the POS, a few transfers
                        $method = [PaymentMethod::Cash, PaymentMethod::Card, PaymentMethod::Card, PaymentMethod::Transfer][mt_rand(0, 3)];
                    }
                    $price = $followUp ? $doctor->follow_up_price : $doctor->consultation_price;
                    $createdAt = $status === AppointmentStatus::Pending ? $now->subMinutes(mt_rand(0, 600)) : $day->min($today)->subDays(3);

                    $appointment = Appointment::create([
                        'doctor_id' => $doctor->id,
                        'patient_id' => $patient->id,
                        'type' => $followUp ? AppointmentType::FollowUp : AppointmentType::Consultation,
                        'date' => $day->format('Y-m-d'),
                        'start_time' => $slot['start'],
                        'end_time' => $slot['end'],
                        'status' => $status,
                        'price' => $price,
                        'payment_method' => $method,
                        'payment_status' => $paid ? PaymentStatus::Paid : PaymentStatus::Unpaid,
                        'booked_by_role' => mt_rand(1, 100) <= 60 ? Role::Patient : Role::Receptionist,
                        'pending_expires_at' => $status === AppointmentStatus::Pending
                            ? $createdAt->addHours(12)->min($startsAt->subHours(6)) : null,
                        'confirmed_at' => $status === AppointmentStatus::Pending ? null : $createdAt,
                        'completed_at' => $status === AppointmentStatus::Completed ? $startsAt->addMinutes(30) : null,
                        // Some recent visits end with "see me again in a week or two", waiting for reception to book
                        ...($status === AppointmentStatus::Completed && $offset >= -10 && mt_rand(1, 100) <= 12 ? [
                            'follow_up_due' => $day->addDays([7, 10, 14][mt_rand(0, 2)])->format('Y-m-d'),
                            'follow_up_note' => mt_rand(0, 1) ? 'بعد نتيجة التحليل' : null,
                        ] : []),
                    ]);
                    $appointment->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->saveQuietly();

                    if ($paid && $price > 0) {
                        $appointment->payments()->create([
                            'method' => $method,
                            'amount' => $price,
                            'status' => TransactionStatus::Paid,
                            'gateway' => $method === PaymentMethod::Online ? 'fake' : 'desk',
                            'received_by' => $method->isDesk() ? $reception->id : null,
                            'reference' => match ($method) {
                                PaymentMethod::Card => 'POS-'.mt_rand(100000, 999999),
                                PaymentMethod::Transfer => 'TRX-'.mt_rand(10000000, 99999999),
                                default => null,
                            },
                            'paid_at' => $createdAt,
                        ]);
                    }
                }
            }
        }

        $this->seedFamily($family, $slots, $today);

        // Demo accounts are pre-verified so they can book straight away
        User::query()->update(['email_verified_at' => now()]);
    }

    /** A past visit and an upcoming one for the demo patient account. */
    private function seedFamily(array $family, SlotService $slots, CarbonImmutable $today): void
    {
        $doctor = Doctor::with('schedules')->find(1);
        foreach ([[$family[0], -9, AppointmentStatus::Completed], [$family[1], 8, AppointmentStatus::Confirmed]] as [$patient, $offset, $status]) {
            $day = $today->addDays($offset);
            while ($day->dayOfWeek === CarbonImmutable::FRIDAY) {
                $day = $day->addDay();
            }
            $free = collect($slots->slotsFor($doctor, $day, Role::Admin))->first(fn ($s) => $s['available'] || $offset < 0);
            if (! $free || Appointment::where('doctor_id', 1)->where('date', $day->format('Y-m-d'))->where('start_time', $free['start'])->exists()) {
                continue;
            }
            Appointment::create([
                'doctor_id' => 1,
                'patient_id' => $patient->id,
                'type' => AppointmentType::Consultation,
                'date' => $day->format('Y-m-d'),
                'start_time' => $free['start'],
                'end_time' => $free['end'],
                'status' => $status,
                'price' => $doctor->consultation_price,
                'payment_method' => PaymentMethod::Online,
                'payment_status' => PaymentStatus::Paid,
                'booked_by_role' => Role::Patient,
                'confirmed_at' => now(),
                // The past visit asks for a follow-up, so the demo patient sees one to book
                ...($status === AppointmentStatus::Completed ? ['follow_up_due' => $today->addDays(6)->format('Y-m-d'), 'follow_up_note' => 'متابعة الضغط بعد العلاج'] : []),
            ]);
        }
    }
}
