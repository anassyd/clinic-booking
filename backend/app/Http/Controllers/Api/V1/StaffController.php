<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\AppointmentStatus;
use App\Enums\PaymentMethod;
use App\Http\Controllers\Controller;
use App\Http\Requests\DeskPaymentRequest;
use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use App\Services\BookingService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/** Reception desk (receptionist + admin). */
class StaffController extends Controller
{
    public function __construct(private readonly BookingService $booking) {}

    // GET /staff/appointments?from=&to=&doctor_id=&status=  — or ?patient_id= for one patient's whole record
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'from' => ['required_without:patient_id', 'date_format:Y-m-d'],
            'to' => ['required_with:from', 'date_format:Y-m-d', 'after_or_equal:from'],
            'patient_id' => ['nullable', 'integer'],
            'doctor_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::enum(AppointmentStatus::class)],
        ]);

        return AppointmentResource::collection(
            Appointment::query()
                ->when($filters['from'] ?? null, fn ($q) => $q->whereBetween('date', [$filters['from'], $filters['to']]))
                ->when($filters['patient_id'] ?? null, fn ($q, $id) => $q->where('patient_id', $id))
                ->when($filters['doctor_id'] ?? null, fn ($q, $id) => $q->where('doctor_id', $id))
                ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
                ->with('patient')
                ->orderBy('date')
                ->orderBy('start_time')
                ->get()
        );
    }

    // GET /staff/pending — the confirmation queue, soonest to auto-cancel first (FR-34)
    public function pending(): AnonymousResourceCollection
    {
        return AppointmentResource::collection(
            Appointment::where('status', AppointmentStatus::Pending)->with('patient', 'doctor')->orderBy('pending_expires_at')->get()
        );
    }

    // PATCH /staff/appointments/{appointment}/confirm
    public function confirm(Request $request, Appointment $appointment): AppointmentResource
    {
        return new AppointmentResource($this->booking->confirm($request->user(), $appointment)->load('patient'));
    }

    // PATCH /staff/appointments/{appointment}/paid — collected at the desk
    public function paid(DeskPaymentRequest $request, Appointment $appointment): AppointmentResource
    {
        $data = $request->validated();

        return new AppointmentResource(
            $this->booking->markPaid($request->user(), $appointment, PaymentMethod::from($data['method']), $data['reference'] ?? null)->load('patient')
        );
    }

    // PATCH /staff/follow-ups/{appointment}/dismiss — close a follow-up request without booking it
    public function dismissFollowUp(Appointment $appointment): AppointmentResource
    {
        return new AppointmentResource($this->booking->dismissFollowUp($appointment)->load('patient', 'doctor'));
    }

    // PATCH /staff/appointments/{appointment}/no-show
    public function noShow(Request $request, Appointment $appointment): AppointmentResource
    {
        return new AppointmentResource($this->booking->markNoShow($request->user(), $appointment)->load('patient'));
    }
}
