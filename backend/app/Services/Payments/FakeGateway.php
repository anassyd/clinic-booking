<?php

namespace App\Services\Payments;

use App\Models\Appointment;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

/**
 * Development gateway: the checkout URL is a signed local route that marks the
 * payment as paid and redirects back to the frontend, mimicking Moyasar's hosted page redirect.
 */
class FakeGateway implements PaymentGateway
{
    public function name(): string
    {
        return 'fake';
    }

    public function checkout(Payment $payment, Appointment $appointment): string
    {
        $payment->update(['gateway_order_id' => 'fake_'.Str::ulid()]);

        return URL::temporarySignedRoute('payments.fake', now()->addMinutes(30), ['payment' => $payment->id]);
    }

    public function refund(Payment $payment): void
    {
        // Nothing to call — the refund is recorded by PaymentService.
    }

    public function parseWebhook(Request $request): WebhookResult
    {
        return new WebhookResult(
            orderId: (string) $request->input('order_id'),
            success: $request->boolean('success'),
            transactionId: $request->input('transaction_id'),
            payload: $request->all(),
        );
    }
}
