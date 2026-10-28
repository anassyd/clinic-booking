<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\AppointmentStatus;
use App\Enums\PaymentMethod;
use App\Enums\Role;
use App\Exceptions\BookingException;
use App\Http\Controllers\Controller;
use App\Http\Requests\CancelRequest;
use App\Http\Requests\SlotRequest;
use App\Http\Requests\StoreAppointmentRequest;
use App\Http\Requests\StorePatientRequest;
use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\Patient;
use App\Services\BookingService;
use App\Services\Payments\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class AppointmentController extends Controller
{
    public function __construct(
        private readonly BookingService $booking,
        private readonly PaymentService $payments,
    ) {}

    // POST /appointments
    public function store(StoreAppointmentRequest $request): JsonResponse
    {
        $user = $request->user();
        $doctor = Doctor::with('schedules')->findOrFail($request->integer('doctor_id'));

        // Patients confirm their email before their first booking (FR-02)
        if ($user->role === Role::Patient && ! $user->hasVerifiedEmail()) {
            throw new BookingException('email_unverified', 403);
        }

        // Doctors book only into their own schedule
        abort_if($user->role === Role::Doctor && $user->doctor?->id !== $doctor->id, 403);

        $appointment = DB::transaction(function () use ($request, $user, $doctor) {
            $patient = $request->filled('patient_id')
                ? Patient::findOrFail($request->integer('patient_id'))
                : Patient::create([
                    ...$request->validate(StorePatientRequest::patientRules('patient.'))['patient'],
                    'user_id' => $user->role === Role::Patient ? $user->id : null,
                    'created_by' => $user->id,
                ]);
            $this->authorize('use', $patient);

            // Staff bookings are collected at the desk
            $method = $user->role->isStaff()
                ? PaymentMethod::Cash
                : PaymentMethod::from($request->input('payment_method', PaymentMethod::Cash->value));

            $followUpOf = $request->filled('follow_up_of') ? Appointment::find($request->integer('follow_up_of')) : null;
            $appointment = $this->booking->book($user, $doctor, $patient, $request->input('date'), $request->input('start'), $method, $request->input('notes'), $followUpOf);

            // Patient at the desk paying now: record it with the booking
            if ($request->filled('payment.method') && $appointment->price > 0) {
                $this->booking->markPaid($user, $appointment, PaymentMethod::from($request->input('payment.method')), $request->input('payment.reference'));
            }

            return $appointment;
        });

        $body = ['data' => new AppointmentResource($appointment->load('patient', 'doctor'))];
        if ($appointment->status === AppointmentStatus::Held) {
            $body['paymentUrl'] = $this->payments->start($appointment)['url'];
        }

        return response()->json($body, 201);
    }

    // GET /follow-ups — follow-ups the doctor asked for and nobody booked yet, soonest due first.
    // Reception sees all of them, an account holder only their family's.
    public function followUps(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        return AppointmentResource::collection(
            Appointment::awaitingFollowUp()
                ->when(! $user->role->isStaff(), fn ($q) => $q->whereIn('patient_id', $user->patients()->select('id')))
                ->with('patient', 'doctor')
                ->orderBy('follow_up_due')
                ->get()
        );
    }

    // GET /appointments/my
    public function mine(Request $request): AnonymousResourceCollection
    {
        return AppointmentResource::collection(
            Appointment::whereIn('patient_id', $request->user()->patients()->select('id'))
                ->with('patient', 'doctor')
                ->orderByDesc('date')
                ->orderByDesc('start_time')
                ->paginate(100)
        );
    }

    // GET /appointments/{appointment}
    public function show(Appointment $appointment): AppointmentResource
    {
        $this->authorize('view', $appointment);

        return new AppointmentResource($appointment->load('patient', 'doctor'));
    }

    // PATCH /appointments/{appointment}/reschedule
    public function reschedule(SlotRequest $request, Appointment $appointment): AppointmentResource
    {
        $this->authorize('modify', $appointment);

        return new AppointmentResource(
            $this->booking->reschedule($request->user(), $appointment, $request->input('date'), $request->input('start'))->load('patient', 'doctor')
        );
    }

    // PATCH /appointments/{appointment}/cancel
    public function cancel(CancelRequest $request, Appointment $appointment): AppointmentResource
    {
        $this->authorize('modify', $appointment);

        return new AppointmentResource(
            $this->booking->cancel($request->user(), $appointment, $request->input('reason'))->load('patient', 'doctor')
        );
    }

    // POST /appointments/{appointment}/pay — retry checkout while the slot is still held
    public function pay(Appointment $appointment): JsonResponse
    {
        $this->authorize('pay', $appointment);
        if ($appointment->status !== AppointmentStatus::Held) {
            throw new BookingException('payment_not_required');
        }

        return response()->json(['paymentUrl' => $this->payments->start($appointment)['url']]);
    }
}
