<?php

namespace App\Http\Requests;

use App\Enums\PaymentMethod;
use App\Enums\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Either an existing patient_id or a new `patient` object (created with the booking).
 * Reception may add `payment` when the patient pays at the desk right away, and
 * `follow_up_of` books the follow-up a doctor asked for on that earlier visit.
 */
class StoreAppointmentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'doctor_id' => ['required', 'integer', Rule::exists('doctors', 'id')->where('is_active', true)],
            'date' => ['required', 'date_format:Y-m-d'],
            'start' => ['required', 'date_format:H:i'],
            'patient_id' => ['nullable', 'required_without:patient', 'integer', 'exists:patients,id'],
            'patient' => ['nullable', 'required_without:patient_id', 'array'],
            ...collect(StorePatientRequest::patientRules('patient.'))
                // Required fields become "required when a new patient is sent"; optional ones stay optional
                ->map(fn (array $rules) => in_array('required', $rules, true)
                    ? ['required_with:patient', ...array_diff($rules, ['required'])]
                    : $rules)
                ->all(),
            'payment_method' => ['sometimes', Rule::enum(PaymentMethod::class)->only([PaymentMethod::Online, PaymentMethod::Cash])],
            'payment' => ['nullable', 'array', Rule::prohibitedIf(! in_array($this->user()->role, [Role::Receptionist, Role::Admin], true))],
            ...DeskPaymentRequest::deskRules('payment.'),
            'follow_up_of' => ['nullable', 'integer', 'exists:appointments,id'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
