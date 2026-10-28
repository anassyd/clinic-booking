<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\AppointmentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use App\Models\DoctorTimeOff;
use App\Services\BookingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TimeOffController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => DoctorTimeOff::query()
            ->when($request->integer('doctor_id'), fn ($q, $id) => $q->where('doctor_id', $id))
            ->where('date', '>=', $request->input('from', today()->format('Y-m-d')))
            ->orderBy('date')
            ->get()]);
    }

    /**
     * POST /admin/time-off — returns the bookings it collides with; with
     * cancel_affected=true they are cancelled, refunded and notified (FR-94).
     */
    public function store(Request $request, BookingService $booking): JsonResponse
    {
        $data = $request->validate([
            'doctor_id' => ['nullable', 'exists:doctors,id'], // null = whole center
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'start' => ['nullable', 'date_format:H:i', 'required_with:end'],
            'end' => ['nullable', 'date_format:H:i', 'required_with:start', 'after:start'],
            'reason' => ['nullable', 'string', 'max:255'],
            'cancel_affected' => ['sometimes', 'boolean'],
        ]);

        $timeOff = DoctorTimeOff::create([
            'doctor_id' => $data['doctor_id'] ?? null,
            'date' => $data['date'],
            'start_time' => $data['start'] ?? null,
            'end_time' => $data['end'] ?? null,
            'reason' => $data['reason'] ?? null,
        ]);

        $affected = Appointment::query()
            ->where('date', $timeOff->date)
            ->when($timeOff->doctor_id, fn ($q, $id) => $q->where('doctor_id', $id))
            ->whereIn('status', AppointmentStatus::open())
            ->with('patient')
            ->get()
            ->filter(fn (Appointment $a) => $timeOff->covers($a->start_time))
            ->values();

        if ($request->boolean('cancel_affected')) {
            $affected->each(fn (Appointment $a) => $booking->cancel($request->user(), $a, $data['reason'] ?? 'doctor_unavailable'));
        }

        return response()->json(['data' => $timeOff, 'affected' => AppointmentResource::collection($affected)], 201);
    }

    public function destroy(DoctorTimeOff $timeOff): JsonResponse
    {
        $timeOff->delete();

        return response()->json(status: 204);
    }
}
