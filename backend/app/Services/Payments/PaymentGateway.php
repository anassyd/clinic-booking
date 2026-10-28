<?php

namespace App\Services\Payments;

use App\Models\Appointment;
use App\Models\Payment;
use Illuminate\Http\Request;

interface PaymentGateway
{
    public function name(): string;

    /** Registers the payment with the gateway and returns the URL to send the patient to. */
    public function checkout(Payment $payment, Appointment $appointment): string;

    /** Refunds a paid transaction in full. */
    public function refund(Payment $payment): void;

    /**
     * Verifies a webhook's signature and extracts its outcome.
     *
     * @throws InvalidWebhookSignature
     */
    public function parseWebhook(Request $request): WebhookResult;
}
