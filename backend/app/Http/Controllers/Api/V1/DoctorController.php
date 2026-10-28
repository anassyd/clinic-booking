<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use App\Services\BookingService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** The signed-in doctor's own schedule (FR-60…64). */
class DoctorController extends Controller
{
    public function __construct(private readonly BookingService $booking) {}

    // GET /doctor/appointments?view=day|week|month&date=  or  ?from=&to=
    public function index(Request $request): AnonymousResourceCollection
    {
        $input = $request->validate([
            'view' => ['required_without:from', 'in:day,week,month'],
            'date' => ['required_with:view', 'date_format:Y-m-d'],
            'from' => ['required_without:view', 'date_format:Y-m-d'],
            'to' => ['required_with:from', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $date = CarbonImmutable::parse($input['date'] ?? $input['from']);
        // Weeks run Saturday → Friday
        [$from, $to] = match ($input['view'] ?? 'range') {
            'range' => [CarbonImmutable::parse($input['from']), CarbonImmutable::parse($input['to'])],
            'day' => [$date, $date],
            'week' => [$date->startOfWeek(CarbonImmutable::SATURDAY), $date->endOfWeek(CarbonImmutable::FRIDAY)],
            'month' => [
                $date->startOfMonth()->startOfWeek(CarbonImmutable::SATURDAY),
                $date->endOfMonth()->endOfWeek(CarbonImmutable::FRIDAY),
            ],
        };

        return AppointmentResource::collection(
            Appointment::where('doctor_id', $request->user()->doctor->id)
                ->whereBetween('date', [$from->format('Y-m-d'), $to->format('Y-m-d')])
                ->with('patient')
                ->orderBy('date')
                ->orderBy('start_time')
                ->get()
        )->additional(['meta' => ['from' => $from->format('Y-m-d'), 'to' => $to->format('Y-m-d')]]);
    }

    // PATCH /doctor/appointments/{appointment}/complete
    //   {follow_up?: {due, note?}}   ask reception / the patient to book it by that date
    //   {follow_up?: {due, start}}   book it now, on that date and time
    public function complete(Request $request, Appointment $appointment): JsonResponse
    {
        $this->authorize('treat', $appointment);
        $input = $request->validate([
            'follow_up' => ['nullable', 'array'],
            'follow_up.due' => ['required_with:follow_up', 'date_format:Y-m-d', 'after:today'],
            'follow_up.start' => ['nullable', 'date_format:H:i'],
            'follow_up.note' => ['nullable', 'string', 'max:500'],
        ]);

        $result = $this->booking->complete(
            $request->user(),
            $appointment,
            $input['follow_up']['due'] ?? null,
            $input['follow_up']['note'] ?? null,
            $input['follow_up']['start'] ?? null,
        );

        return response()->json([
            'data' => new AppointmentResource($result['appointment']->load('patient')),
            'followUp' => $result['followUp'] ? new AppointmentResource($result['followUp']->load('patient')) : null,
        ]);
    }

    // PATCH /doctor/appointments/{appointment}/no-show
    public function noShow(Request $request, Appointment $appointment): AppointmentResource
    {
        $this->authorize('treat', $appointment);

        return new AppointmentResource($this->booking->markNoShow($request->user(), $appointment)->load('patient'));
    }
}
