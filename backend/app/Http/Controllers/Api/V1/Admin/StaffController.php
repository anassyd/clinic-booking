<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\Gender;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePatientRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/** Receptionist, doctor and admin accounts (FR-04, FR-95). */
class StaffController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return UserResource::collection(User::where('role', '!=', Role::Patient)->with('doctor')->orderBy('id')->get());
    }

    public function store(Request $request): UserResource
    {
        return new UserResource(User::create($this->validated($request))->load('doctor'));
    }

    public function update(Request $request, User $user): UserResource
    {
        abort_if($user->role === Role::Patient, 404);
        $user->update($this->validated($request, $user));

        return new UserResource($user->load('doctor'));
    }

    private function validated(Request $request, ?User $user = null): array
    {
        $required = $user ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'min:3', 'max:120'],
            'email' => [$required, 'email', Rule::unique('users')->ignore($user)],
            'phone' => ['sometimes', 'nullable', 'regex:'.StorePatientRequest::PHONE],
            'password' => [$required, Password::min(8)],
            'role' => [$required, Rule::in([Role::Receptionist->value, Role::Doctor->value, Role::Admin->value])],
            'gender' => ['sometimes', 'nullable', Rule::enum(Gender::class)],
            'locale' => ['sometimes', 'in:ar,en'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
