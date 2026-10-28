<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\AppointmentStatus;
use App\Enums\TransactionStatus;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\Payment;
use App\Services\SlotService;
use App\Support\ClinicSettings;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** GET /admin/reports?from=&to=[&format=csv] — FR-97. */
class ReportController extends Controller
{
    public function __invoke(Request $request, SlotService $slots): JsonResponse|StreamedResponse
    {
        $range = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'format' => ['sometimes', 'in:json,csv'],
        ]);
        $from = CarbonImmutable::parse($range['from']);
        $to = CarbonImmutable::parse($range['to']);

        $appointments = Appointment::whereBetween('date', [$range['from'], $range['to']])->get(['doctor_id', 'status']);
        $revenue = Payment::query()
            ->join('appointments', 'appointments.id', '=', 'payments.appointment_id')
            ->whereBetween('appointments.date', [$range['from'], $range['to']])
            ->where('payments.status', TransactionStatus::Paid)
            ->selectRaw('appointments.doctor_id, SUM(payments.amount) AS total')
            ->groupBy('appointments.doctor_id')
            ->pluck('total', 'doctor_id');

        $rows = Doctor::with('schedules', 'specialty')->orderBy('id')->get()->map(function (Doctor $doctor) use ($appointments, $revenue, $from, $to, $slots) {
            $mine = $appointments->where('doctor_id', $doctor->id);
            $count = fn (AppointmentStatus $s) => $mine->where('status', $s)->count();
            $booked = $mine->where('status', '!=', AppointmentStatus::Cancelled)->count();

            $capacity = 0;
            for ($d = $from; $d <= $to; $d = $d->addDay()) {
                $schedule = $doctor->scheduleFor($d->dayOfWeek);
                if ($schedule && ! ClinicSettings::isWeeklyOff($d->dayOfWeek)) {
                    $capacity += count($slots->slotTimes($schedule->start_time, $schedule->end_time));
                }
            }

            return [
                'doctorId' => $doctor->id,
                'doctor' => $doctor->name,
                'specialtyId' => $doctor->specialty_id,
                'specialty' => $doctor->specialty->name,
                'booked' => $booked,
                'completed' => $count(AppointmentStatus::Completed),
                'noShow' => $count(AppointmentStatus::NoShow),
                'cancelled' => $count(AppointmentStatus::Cancelled),
                'capacity' => $capacity,
                'occupancy' => $capacity ? round($booked / $capacity, 3) : 0,
                'noShowRate' => $booked ? round($count(AppointmentStatus::NoShow) / $booked, 3) : 0,
                'revenue' => (int) ($revenue[$doctor->id] ?? 0),
            ];
        });

        if (($range['format'] ?? 'json') === 'csv') {
            $locale = app()->getLocale();

            return response()->streamDownload(function () use ($rows, $locale) {
                $out = fopen('php://output', 'w');
                fwrite($out, "\xEF\xBB\xBF"); // BOM so Excel reads Arabic correctly
                fputcsv($out, ['doctor', 'specialty', 'booked', 'completed', 'no_show', 'cancelled', 'capacity', 'occupancy', 'no_show_rate', 'revenue_sar']);
                foreach ($rows as $r) {
                    fputcsv($out, [$r['doctor'][$locale], $r['specialty'][$locale], $r['booked'], $r['completed'], $r['noShow'], $r['cancelled'], $r['capacity'], $r['occupancy'], $r['noShowRate'], $r['revenue']]);
                }
                fclose($out);
            }, "report-{$range['from']}-{$range['to']}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
        }

        return response()->json([
            'data' => $rows,
            'totals' => [
                'booked' => $rows->sum('booked'),
                'completed' => $rows->sum('completed'),
                'noShow' => $rows->sum('noShow'),
                'cancelled' => $rows->sum('cancelled'),
                'capacity' => $rows->sum('capacity'),
                'revenue' => $rows->sum('revenue'),
            ],
        ]);
    }
}
