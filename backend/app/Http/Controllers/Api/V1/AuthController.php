<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\Gender;
use App\Enums\Role;
use App\Exceptions\BookingException;
use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;

class AuthController extends Controller
{
    // POST /auth/register — patients only; staff accounts are created by admins (FR-04)
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create([...$request->validated(), 'role' => Role::Patient, 'locale' => $request->input('locale', app()->getLocale())]);
        $user->sendEmailVerificationNotification();

        return $this->tokenResponse($user, 201);
    }

    // POST /auth/login
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->string('email')->lower())->first();
        if (! $user || ! Hash::check($request->input('password'), $user->password)) {
            throw new BookingException('invalid_credentials', 401);
        }
        if (! $user->is_active) {
            throw new BookingException('account_disabled', 403);
        }

        return $this->tokenResponse($user);
    }

    // POST /auth/logout
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(status: 204);
    }

    // GET /me
    public function me(Request $request): UserResource
    {
        return new UserResource($request->user()->load('doctor'));
    }

    // PATCH /me
    public function update(Request $request): UserResource
    {
        $request->user()->update($request->validate([
            'name' => ['sometimes', 'string', 'min:3', 'max:120'],
            'gender' => ['sometimes', 'nullable', Rule::enum(Gender::class)],
            'locale' => ['sometimes', 'in:ar,en'],
        ]));

        return new UserResource($request->user()->load('doctor'));
    }

    // GET /auth/email/verify/{id}/{hash}?expires=&signature= (signed:relative) — FR-02
    public function verifyEmail(Request $request, int $id, string $hash): JsonResponse
    {
        $user = User::find($id);
        if (! $user || ! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            throw new BookingException('invalid_verification_link', 403);
        }
        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
        }

        return response()->json(['verified' => true]);
    }

    // POST /auth/email/resend
    public function resendVerification(Request $request): JsonResponse
    {
        if (! $request->user()->hasVerifiedEmail()) {
            $request->user()->sendEmailVerificationNotification();
        }

        return response()->json(['sent' => true]);
    }

    // POST /auth/forgot-password — same answer whether or not the email exists (no account enumeration)
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);
        Password::sendResetLink(['email' => $request->string('email')->lower()->value()]);

        return response()->json(['sent' => true]);
    }

    // POST /auth/reset-password — FR-03; signs the user out everywhere
    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        $status = Password::reset($data, function (User $user, string $password) {
            $user->forceFill(['password' => $password])->save();
            $user->tokens()->delete();
            event(new PasswordReset($user));
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw new BookingException('invalid_reset_token');
        }

        return response()->json(['reset' => true]);
    }

    private function tokenResponse(User $user, int $status = 200): JsonResponse
    {
        return response()->json([
            'token' => $user->createToken('spa')->plainTextToken,
            'user' => new UserResource($user->load('doctor')),
        ], $status);
    }
}
