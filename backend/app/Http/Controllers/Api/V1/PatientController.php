<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePatientRequest;
use App\Http\Resources\PatientResource;
use App\Models\Patient;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PatientController extends Controller
{
    // GET /patients — the account holder's family
    public function index(Request $request): AnonymousResourceCollection
    {
        return PatientResource::collection($request->user()->patients()->orderBy('id')->get());
    }

    // GET /patients/search?q= — staff look up by phone or name before adding (FR-12)
    public function search(Request $request): AnonymousResourceCollection
    {
        $q = trim((string) $request->validate(['q' => ['required', 'string', 'min:3']])['q']);

        return PatientResource::collection(
            Patient::where('phone', 'like', "%{$q}%")
                ->orWhere('name', 'like', "%{$q}%")
                ->orWhere('national_id', 'like', "{$q}%")
                ->limit(20)
                ->get()
        );
    }

    // POST /patients
    public function store(StorePatientRequest $request): PatientResource
    {
        $user = $request->user();

        return new PatientResource(Patient::create([
            ...$request->validated(),
            'user_id' => $user->role === Role::Patient ? $user->id : null,
            'locale' => $request->input('locale') ?? $user->locale ?? config('app.locale'),
            'created_by' => $user->id,
        ]));
    }

    // GET /patients/{patient}
    public function show(Request $request, Patient $patient): PatientResource
    {
        $this->authorize('use', $patient);

        return new PatientResource($patient);
    }

    // PUT /patients/{patient}
    public function update(StorePatientRequest $request, Patient $patient): PatientResource
    {
        $this->authorize('use', $patient);
        $patient->update($request->validated());

        return new PatientResource($patient);
    }
}
