<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use App\Notifications\Auth\ResetPassword;
use App\Notifications\Auth\VerifyEmail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

class AuthFlowTest extends BookingTestCase
{
    public function test_registration_sends_a_verification_link_to_the_frontend(): void
    {
        $this->postJson('/api/v1/auth/register', ['name' => 'نورة العتيبي', 'email' => 'n@example.com', 'phone' => '0501234567', 'password' => 'secret123', 'gender' => 'female'])
            ->assertCreated()->assertJsonPath('user.emailVerified', false)->assertJsonPath('user.gender', 'female');

        $user = User::where('email', 'n@example.com')->first();
        Notification::assertSentTo($user, VerifyEmail::class, function (VerifyEmail $n) use ($user) {
            $url = $n->toMail($user)->actionUrl;

            return str_starts_with($url, 'http://localhost:5173/verify-email?path=');
        });
    }

    public function test_unverified_patients_cannot_book_until_they_confirm(): void
    {
        $user = User::factory()->unverified()->create(['role' => Role::Patient]);
        $patient = $this->familyMember($user);
        Sanctum::actingAs($user);

        $this->book(['patient_id' => $patient->id])->assertForbidden()->assertJson(['code' => 'email_unverified']);

        // Follow the link exactly as the frontend would: it calls the relative signed path
        $mail = (new VerifyEmail)->toMail($user);
        parse_str(parse_url($mail->actionUrl, PHP_URL_QUERY), $query);
        $this->getJson($query['path'])->assertOk()->assertJson(['verified' => true]);

        $this->assertTrue($user->fresh()->hasVerifiedEmail());
        Sanctum::actingAs($user->fresh());
        $this->book(['patient_id' => $patient->id])->assertCreated();
    }

    public function test_tampered_or_wrong_verification_links_are_rejected(): void
    {
        $user = User::factory()->unverified()->create();
        parse_str(parse_url((new VerifyEmail)->toMail($user)->actionUrl, PHP_URL_QUERY), $query);

        $this->getJson(str_replace('signature=', 'signature=x', $query['path']))->assertForbidden();
        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_resend_verification(): void
    {
        $user = User::factory()->unverified()->create(['role' => Role::Patient]);
        Sanctum::actingAs($user);
        $this->postJson('/api/v1/auth/email/resend')->assertOk();
        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_password_reset_round_trip_and_session_revocation(): void
    {
        $user = User::factory()->create(['email' => 'reset@example.com']);
        $oldToken = $user->createToken('spa')->plainTextToken;

        // Unknown emails get the same answer (no account enumeration)
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'nobody@example.com'])->assertOk()->assertJson(['sent' => true]);
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'reset@example.com'])->assertOk();

        $token = null;
        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $n) use (&$token, $user) {
            $token = $n->token;

            return str_contains($n->toMail($user)->actionUrl, '/reset-password?token=');
        });

        $this->postJson('/api/v1/auth/reset-password', ['token' => 'wrong', 'email' => 'reset@example.com', 'password' => 'newsecret1', 'password_confirmation' => 'newsecret1'])
            ->assertStatus(422)->assertJson(['code' => 'invalid_reset_token']);
        $this->postJson('/api/v1/auth/reset-password', ['token' => $token, 'email' => 'reset@example.com', 'password' => 'newsecret1', 'password_confirmation' => 'different'])
            ->assertJsonValidationErrors('password');

        $this->postJson('/api/v1/auth/reset-password', ['token' => $token, 'email' => 'reset@example.com', 'password' => 'newsecret1', 'password_confirmation' => 'newsecret1'])
            ->assertOk();

        $this->postJson('/api/v1/auth/login', ['email' => 'reset@example.com', 'password' => 'newsecret1'])->assertOk();
        $this->assertSame(1, $user->tokens()->count()); // the old session was revoked, only the new login remains
        $this->assertFalse(Str::contains((string) $user->tokens()->first()->token, explode('|', $oldToken)[1]));
    }
}
