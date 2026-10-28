<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\AppointmentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\AppointmentResource;
use App\Http\Resources\DoctorResource;
use App\Models\Doctor;
use App\Services\SlotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class DoctorController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return DoctorResource::collection(Doctor::with('schedules', 'specialty')->orderBy('id')->get());
    }

    public function store(Request $request): DoctorResource
    {
        return new DoctorResource(Doctor::create($this->validated($request))->load('schedules'));
    }

    public function update(Request $request, Doctor $doctor): DoctorResource
    {
        $doctor->update($this->validated($request, $doctor));

        return new DoctorResource($doctor->load('schedules'));
    }

    public function destroy(Doctor $doctor): DoctorResource
    {
        $doctor->update(['is_active' => false]);

        return new DoctorResource($doctor);
    }

    /**
     * PUT /admin/doctors/{doctor}/schedules — replaces the weekly schedule (FR-92).
     * Existing bookings are never cancelled; ones now outside working hours are returned for review.
     */
    public function schedules(Request $request, Doctor $doctor, SlotService $slots): JsonResponse
    {
        $data = $request->validate([
            'schedules' => ['present', 'array', 'max:7'],
            'schedules.*.day_of_week' => ['required', 'integer', 'between:0,6', 'distinct'],
            'schedules.*.start' => ['required', 'date_format:H:i'],
            'schedules.*.end' => ['required', 'date_format:H:i', 'after:schedules.*.start'],
        ]);

        DB::transaction(function () use ($doctor, $data) {
            $doctor->schedules()->delete();
            foreach ($data['schedules'] as $row) {
                $doctor->schedules()->create([
                    'day_of_week' => $row['day_of_week'],
                    'start_time' => $row['start'],
                    'end_time' => $row['end'],
                ]);
            }
        });
        $doctor->load('schedules');

        $outside = $doctor->appointments()
            ->whereIn('status', AppointmentStatus::open())
            ->where('date', '>=', today()->format('Y-m-d'))
            ->with('patient')
            ->get()
            ->reject(fn ($a) => $slots->isOnGrid($doctor, $a->startsAt()->toImmutable(), $a->start_time));

        return response()->json([
            'data' => new DoctorResource($doctor),
            'outsideSchedule' => AppointmentResource::collection($outside->values()),
        ]);
    }

    private function validated(Request $request, ?Doctor $doctor = null): array
    {
        $required = $doctor ? 'sometimes' : 'required';

        return $request->validate([
            'user_id' => ['sometimes', 'nullable', 'exists:users,id', Rule::unique('doctors')->ignore($doctor)],
            'specialty_id' => [$required, 'exists:specialties,id'],
            'name' => [$required, 'array:ar,en'],
            'name.ar' => ['required_with:name', 'string', 'max:120'],
            'name.en' => ['required_with:name', 'string', 'max:120'],
            'title' => ['sometimes', 'nullable', 'array:ar,en'],
            'bio' => ['sometimes', 'nullable', 'array:ar,en'],
            'photo' => ['sometimes', 'nullable', 'url'],
            'years_of_experience' => ['sometimes', 'integer', 'between:0,70'],
            'consultation_price' => [$required, 'integer', 'min:0'],
            'follow_up_price' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
