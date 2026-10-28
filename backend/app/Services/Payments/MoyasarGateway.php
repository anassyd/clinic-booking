<?php

namespace App\Services\Payments;

use App\Models\Appointment;
use App\Models\Payment;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Moyasar hosted invoice page (mada, Visa/Mastercard, Apple Pay, STC Pay).
 *
 * Verify field names against https://docs.moyasar.com for your account before
 * going live; set MOYASAR_* in .env and PAYMENT_DRIVER=moyasar.
 */
class MoyasarGateway implements PaymentGateway
{
    public function __construct(private readonly array $config) {}

    public function name(): string
    {
        return 'moyasar';
    }

    public function checkout(Payment $payment, Appointment $appointment): string
    {
        $back = rtrim(config('clinic.frontend_url'), '/').'/my?payment='.$payment->id;

        $invoice = $this->client()->post('/invoices', [
            'amount' => $payment->amount * 100, // halalas
            'currency' => $payment->currency,
            'description' => 'Consultation #'.$appointment->id,
            'callback_url' => route('webhooks.moyasar'),
            'success_url' => $back,
            'back_url' => $back,
            'expired_at' => now()->addMinutes(15)->toIso8601String(),
            'metadata' => ['payment_id' => (string) $payment->id, 'appointment_id' => (string) $appointment->id],
        ])->throw()->json();

        $payment->update(['gateway_order_id' => $invoice['id'] ?? throw new RuntimeException('Moyasar: missing invoice id')]);

        return $invoice['url'] ?? throw new RuntimeException('Moyasar: missing invoice url');
    }

    public function refund(Payment $payment): void
    {
        $this->client()->post("/payments/{$payment->gateway_txn_id}/refund", [
            'amount' => $payment->amount * 100,
        ])->throw();
    }

    public function parseWebhook(Request $request): WebhookResult
    {
        if (! hash_equals((string) $this->config['webhook_secret'], (string) $request->input('secret_token'))) {
            throw new InvalidWebhookSignature('Moyasar secret_token mismatch');
        }

        $data = (array) $request->input('data', []);
        $type = (string) $request->input('type');

        return new WebhookResult(
            orderId: (string) Arr::get($data, 'invoice_id'),
            success: $type === 'payment_paid' && Arr::get($data, 'status') === 'paid',
            transactionId: Arr::get($data, 'id'),
            payload: $request->except('secret_token'),
            isRefund: $type === 'payment_refunded',
        );
    }

    private function client(): PendingRequest
    {
        return Http::baseUrl($this->config['base_url'])
            ->withBasicAuth((string) $this->config['secret_key'], '')
            ->acceptJson()
            ->timeout(15);
    }
}
