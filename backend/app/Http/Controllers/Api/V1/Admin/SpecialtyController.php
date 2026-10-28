<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\SpecialtyResource;
use App\Models\Specialty;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class SpecialtyController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return SpecialtyResource::collection(Specialty::withCount('doctors')->orderBy('id')->get());
    }

    public function store(Request $request): SpecialtyResource
    {
        return new SpecialtyResource(Specialty::create($this->validated($request)));
    }

    public function update(Request $request, Specialty $specialty): SpecialtyResource
    {
        $specialty->update($this->validated($request, $specialty));

        return new SpecialtyResource($specialty);
    }

    /** Specialties are deactivated, never deleted, so history keeps its references. */
    public function destroy(Specialty $specialty): SpecialtyResource
    {
        $specialty->update(['is_active' => false]);

        return new SpecialtyResource($specialty);
    }

    private function validated(Request $request, ?Specialty $specialty = null): array
    {
        $required = $specialty ? 'sometimes' : 'required';

        return $request->validate([
            'slug' => [$required, 'alpha_dash', 'max:60', Rule::unique('specialties')->ignore($specialty)],
            'name' => [$required, 'array:ar,en'],
            'name.ar' => ['required_with:name', 'string', 'max:80'],
            'name.en' => ['required_with:name', 'string', 'max:80'],
            'description' => ['sometimes', 'nullable', 'array:ar,en'],
            'icon' => ['sometimes', 'string', 'max:40'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
