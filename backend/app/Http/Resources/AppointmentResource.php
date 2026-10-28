<?php

namespace App\Http\Resources;

use App\Models\Appointment;
use App\Services\BookingService;
use App\Support\ClinicSettings;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Appointment */
class AppointmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();

        return [
            'id' => $this->id,
            'doctorId' => $this->doctor_id,
            'patientId' => $this->patient_id,
            'parentId' => $this->parent_id,
            'type' => $this->type,
            'date' => $this->date,
            'start' => $this->start_time,
            'end' => $this->end_time,
            'status' => $this->status,
            'price' => $this->price, // SAR, VAT-inclusive
            'vatAmount' => ClinicSettings::vatPortion($this->price),
            'paymentMethod' => $this->payment_method,
            'paymentStatus' => $this->payment_status,
            'bookedBy' => $this->booked_by_role,
            'notes' => $this->notes,
            'cancelReason' => $this->cancel_reason,
            'followUpDue' => $this->follow_up_due,
            'followUpNote' => $this->follow_up_note,
            'holdExpiresAt' => $this->hold_expires_at?->toIso8601String(),
            'pendingExpiresAt' => $this->pending_expires_at?->toIso8601String(),
            'createdAt' => $this->created_at->toIso8601String(),
            // Lets the UI show or lock the reschedule/cancel buttons (FR-41)
            'canModify' => $user && ($user->role->isStaff()
                ? $this->status->isOpen()
                : app(BookingService::class)->canPatientModify($this->resource)),
            'patient' => new PatientResource($this->whenLoaded('patient')),
            'doctor' => new DoctorResource($this->whenLoaded('doctor')),
        ];
    }
}
