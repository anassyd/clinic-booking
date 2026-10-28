<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Doctor;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

class AccessTest extends BookingTestCase
{
    public function test_register_login_and_me(): void
    {
        $this->postJson('/api/v1/auth/register', ['name' => 'مريم خالد', 'email' => 'm@example.com', 'phone' => '0501234567', 'password' => 'secret123'])
            ->assertCreated()->assertJsonPath('user.role', 'patient')->assertJsonStructure(['token']);

        $token = $this->postJson('/api/v1/auth/login', ['email' => 'm@example.com', 'password' => 'secret123'])->assertOk()->json('token');
        $this->withToken($token)->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.email', 'm@example.com');

        $this->postJson('/api/v1/auth/login', ['email' => 'm@example.com', 'password' => 'wrong'])
            ->assertUnauthorized()->assertJson(['code' => 'invalid_credentials']);
    }

    public function test_registration_cannot_grant_a_staff_role(): void
    {
        $this->postJson('/api/v1/auth/register', ['name' => 'Eve Hacker', 'email' => 'e@example.com', 'phone' => '0501234567', 'password' => 'secret123', 'role' => 'admin'])
            ->assertCreated()->assertJsonPath('user.role', 'patient');
    }

    public function test_role_gates(): void
    {
        $this->actingAsPatient();
        $this->getJson('/api/v1/staff/pending')->assertForbidden();
        $this->getJson('/api/v1/doctor/appointments?view=day&date=2026-10-27')->assertForbidden();
        $this->getJson('/api/v1/admin/settings')->assertForbidden();
        $this->getJson('/api/v1/patients/search?q=010')->assertForbidden();

        $this->actingAsRole(Role::Receptionist);
        $this->getJson('/api/v1/staff/pending')->assertOk();
        $this->getJson('/api/v1/admin/settings')->assertForbidden();

        $this->getJson('/api/v1/staff/pending', ['Authorization' => ''])->assertOk(); // still acting as receptionist
    }

    public function test_patients_only_see_their_own_appointments(): void
    {
        $this->actingAsPatient();
        $id = $this->book()->json('data.id');

        Sanctum::actingAs(User::factory()->create(['role' => Role::Patient]));
        $this->getJson("/api/v1/appointments/{$id}")->assertForbidden();
        $this->patchJson("/api/v1/appointments/{$id}/cancel")->assertForbidden();
        $this->getJson('/api/v1/appointments/my')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_doctors_only_treat_their_own_patients(): void
    {
        $this->actingAsPatient();
        $id = $this->book()->json('data.id');

        $other = Doctor::factory()->withSchedule()->create();
        $user = User::factory()->create(['role' => Role::Doctor]);
        $other->update(['user_id' => $user->id]);
        Sanctum::actingAs($user);

        $this->getJson("/api/v1/appointments/{$id}")->assertForbidden();
        $this->patchJson("/api/v1/doctor/appointments/{$id}/complete")->assertForbidden();
    }
}
