<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\DoctorResource;
use App\Http\Resources\SpecialtyResource;
use App\Models\Doctor;
use App\Models\Specialty;
use App\Services\SlotService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** Public catalog + availability. Guests see what a patient would see. */
class CatalogController extends Controller
{
    public function __construct(private readonly SlotService $slots) {}

    // GET /specialties
    public function specialties(): AnonymousResourceCollection
    {
        return SpecialtyResource::collection(
            Specialty::where('is_active', true)->withCount(['doctors' => fn ($q) => $q->where('is_active', true)])->orderBy('id')->get()
        );
    }

    // GET /doctors?specialty_id=
    public function doctors(Request $request): AnonymousResourceCollection
    {
        return DoctorResource::collection(
            Doctor::where('is_active', true)
                ->when($request->integer('specialty_id'), fn ($q, $id) => $q->where('specialty_id', $id))
                ->with('schedules')
                ->orderBy('id')
                ->get()
        );
    }

    // GET /specialties/{specialty}/doctors
    public function specialtyDoctors(Specialty $specialty): AnonymousResourceCollection
    {
        return DoctorResource::collection($specialty->doctors()->where('is_active', true)->with('schedules')->get());
    }

    // GET /doctors/{doctor}
    public function doctor(Doctor $doctor): DoctorResource
    {
        abort_unless($doctor->is_active, 404);

        return new DoctorResource($doctor->load('schedules', 'specialty'));
    }

    // GET /doctors/{doctor}/availability
    public function availability(Request $request, Doctor $doctor): JsonResponse
    {
        return response()->json(['data' => $this->slots->availability($doctor->load('schedules'), $this->role($request))]);
    }

    // GET /doctors/{doctor}/slots?date=&ignore=
    public function slots(Request $request, Doctor $doctor): JsonResponse
    {
        $request->validate(['date' => ['required', 'date_format:Y-m-d'], 'ignore' => ['nullable', 'integer']]);

        return response()->json(['data' => $this->slots->slotsFor(
            $doctor->load('schedules'),
            CarbonImmutable::parse($request->input('date')),
            $this->role($request),
            $request->integer('ignore') ?: null,
        )]);
    }

    /** Optional auth on public routes: staff tokens unlock same-day slots. */
    private function role(Request $request): Role
    {
        return $request->user('sanctum')?->role ?? Role::Patient;
    }
}
