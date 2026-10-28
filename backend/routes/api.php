<?php

use App\Http\Controllers\Api\V1\Admin;
use App\Http\Controllers\Api\V1\AppointmentController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CatalogController;
use App\Http\Controllers\Api\V1\DoctorController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\PatientController;
use App\Http\Controllers\Api\V1\StaffController;
use App\Http\Controllers\Api\V1\WebhookController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->middleware('locale')->group(function () {
    /* Public -------------------------------------------------------------- */
    Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:login');
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:login');
    Route::post('auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:login');
    Route::get('auth/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
        ->middleware(['signed:relative', 'throttle:login'])->name('verification.verify');

    Route::get('specialties', [CatalogController::class, 'specialties']);
    Route::get('specialties/{specialty}/doctors', [CatalogController::class, 'specialtyDoctors']);
    Route::get('doctors', [CatalogController::class, 'doctors']);
    Route::get('doctors/{doctor}', [CatalogController::class, 'doctor']);
    Route::get('doctors/{doctor}/availability', [CatalogController::class, 'availability']);
    Route::get('doctors/{doctor}/slots', [CatalogController::class, 'slots']);

    Route::post('webhooks/moyasar', [WebhookController::class, 'payment'])->name('webhooks.moyasar');
    Route::get('webhooks/whatsapp', [WebhookController::class, 'whatsappVerify']);
    Route::post('webhooks/whatsapp', [WebhookController::class, 'whatsapp']);
    Route::get('payments/fake/{payment}', [WebhookController::class, 'fakeCheckout'])
        ->middleware('signed')->name('payments.fake');

    /* Signed in ----------------------------------------------------------- */
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('auth/email/resend', [AuthController::class, 'resendVerification'])->middleware('throttle:login');
        Route::get('me', [AuthController::class, 'me']);
        Route::patch('me', [AuthController::class, 'update']);

        Route::get('patients', [PatientController::class, 'index']);
        Route::post('patients', [PatientController::class, 'store']);
        Route::get('patients/search', [PatientController::class, 'search'])->middleware('role:receptionist,doctor,admin');
        Route::get('patients/{patient}', [PatientController::class, 'show']);
        Route::put('patients/{patient}', [PatientController::class, 'update']);

        Route::post('appointments', [AppointmentController::class, 'store'])->middleware('throttle:booking');
        Route::get('follow-ups', [AppointmentController::class, 'followUps'])->middleware('role:patient,receptionist,admin');
        Route::get('appointments/my', [AppointmentController::class, 'mine'])->middleware('role:patient');
        Route::get('appointments/{appointment}', [AppointmentController::class, 'show']);
        Route::patch('appointments/{appointment}/reschedule', [AppointmentController::class, 'reschedule']);
        Route::patch('appointments/{appointment}/cancel', [AppointmentController::class, 'cancel']);
        Route::post('appointments/{appointment}/pay', [AppointmentController::class, 'pay']);

        Route::middleware('role:receptionist,doctor')->group(function () {
            Route::get('notifications', [NotificationController::class, 'index']);
            Route::patch('notifications/{id}/read', [NotificationController::class, 'read']);
            Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
        });

        Route::prefix('staff')->middleware('role:receptionist,admin')->group(function () {
            Route::get('appointments', [StaffController::class, 'index']);
            Route::get('pending', [StaffController::class, 'pending']);
            Route::patch('appointments/{appointment}/confirm', [StaffController::class, 'confirm']);
            Route::patch('appointments/{appointment}/paid', [StaffController::class, 'paid']);
            Route::patch('appointments/{appointment}/no-show', [StaffController::class, 'noShow']);
            Route::patch('follow-ups/{appointment}/dismiss', [StaffController::class, 'dismissFollowUp']);
        });

        Route::prefix('doctor')->middleware('role:doctor')->name('doctor.')->group(function () {
            Route::get('appointments', [DoctorController::class, 'index']);
            Route::patch('appointments/{appointment}/complete', [DoctorController::class, 'complete'])->name('appointments.complete');
            Route::patch('appointments/{appointment}/no-show', [DoctorController::class, 'noShow']);
        });

        Route::prefix('admin')->middleware('role:admin')->group(function () {
            Route::apiResource('specialties', Admin\SpecialtyController::class)->except('show');
            Route::apiResource('doctors', Admin\DoctorController::class)->except('show');
            Route::put('doctors/{doctor}/schedules', [Admin\DoctorController::class, 'schedules']);
            Route::get('time-off', [Admin\TimeOffController::class, 'index']);
            Route::post('time-off', [Admin\TimeOffController::class, 'store']);
            Route::delete('time-off/{timeOff}', [Admin\TimeOffController::class, 'destroy']);
            Route::get('staff', [Admin\StaffController::class, 'index']);
            Route::post('staff', [Admin\StaffController::class, 'store']);
            Route::put('staff/{user}', [Admin\StaffController::class, 'update']);
            Route::get('settings', [Admin\SettingsController::class, 'show']);
            Route::put('settings', [Admin\SettingsController::class, 'update']);
            Route::get('reports', Admin\ReportController::class);
            Route::get('refunds', [Admin\RefundController::class, 'index']);
            Route::post('refunds/{payment}/retry', [Admin\RefundController::class, 'retry']);
        });
    });
});
