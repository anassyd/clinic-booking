<?php

namespace App\Services\Payments;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\TransactionStatus;
use App\Models\Appointment;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class PaymentService
{
    public function __construct(private readonly PaymentGateway $gateway) {}

    /** POST /appointments/{id}/pay — returns the URL the patient is redirected to. */
    public function start(Appointment $appointment): array
    {
        $payment = $appointment->payments()->create([
            'method' => PaymentMethod::Online,
            'amount' => $appointment->price,
            'currency' => config('clinic.currency'),
            'status' => TransactionStatus::Pending,
            'gateway' => $this->gateway->name(),
        ]);

        return ['payment' => $payment, 'url' => $this->gateway->checkout($payment, $appointment)];
    }

    /**
     * Applies a verified gateway result exactly once (gateway_order_id is unique).
     *
     * @return Payment|null the payment that just became paid, if any
     */
    public function apply(WebhookResult $result): ?Payment
    {
        return DB::transaction(function () use ($result) {
            $payment = Payment::query()->where('gateway_order_id', $result->orderId)->lockForUpdate()->first();
            if (! $payment || $payment->status !== TransactionStatus::Pending) {
                return null; // unknown or already applied
            }

            $payment->update([
                'status' => $result->success ? TransactionStatus::Paid : TransactionStatus::Failed,
                'gateway_txn_id' => $result->transactionId,
                'raw_payload' => $result->payload,
                'paid_at' => $result->success ? now() : null,
            ]);

            return $result->success ? $payment : null;
        });
    }

    /** Records money collected at the front desk (cash, POS card or bank transfer). */
    public function recordDesk(Appointment $appointment, PaymentMethod $method, User $receiver, ?string $reference = null): Payment
    {
        $payment = $appointment->payments()->create([
            'method' => $method,
            'amount' => $appointment->price,
            'currency' => config('clinic.currency'),
            'status' => TransactionStatus::Paid,
            'gateway' => 'desk',
            'received_by' => $receiver->id,
            'reference' => $reference,
            'paid_at' => now(),
        ]);
        $appointment->update(['payment_method' => $method, 'payment_status' => PaymentStatus::Paid]);

        return $payment;
    }

    /**
     * Full refund of every paid transaction on the appointment (SRS FR-43/44).
     * A gateway failure keeps the cancellation and leaves the payment for an admin retry.
     */
    public function refund(Appointment $appointment): void
    {
        $appointment->payments()
            ->where('status', TransactionStatus::Paid)
            ->get()
            ->each(fn (Payment $payment) => $this->attemptRefund($payment));

        $this->syncAppointmentStatus($appointment);
    }

    /** POST /admin/refunds/{payment}/retry */
    public function retryRefund(Payment $payment): bool
    {
        $ok = $payment->status === TransactionStatus::Paid && $this->attemptRefund($payment);
        $this->syncAppointmentStatus($payment->appointment);

        return $ok;
    }

    private function attemptRefund(Payment $payment): bool
    {
        if ($payment->method === PaymentMethod::Online) {
            try {
                $this->gateway->refund($payment);
            } catch (Throwable $e) {
                Log::error('Refund failed', ['payment' => $payment->id, 'error' => $e->getMessage()]);
                $payment->update([
                    'refund_error' => mb_substr($e->getMessage(), 0, 1000),
                    'refund_attempts' => $payment->refund_attempts + 1,
                    'refund_failed_at' => now(),
                ]);

                return false;
            }
        }

        $payment->update([
            'status' => TransactionStatus::Refunded,
            'refunded_at' => now(),
            'refund_error' => null,
            'refund_failed_at' => null,
            'refund_attempts' => $payment->refund_attempts + 1,
        ]);

        return true;
    }

    /** "refunded" only once nothing is left to give back; otherwise "refund_pending". */
    private function syncAppointmentStatus(Appointment $appointment): void
    {
        if (! in_array($appointment->payment_status, [PaymentStatus::Paid, PaymentStatus::RefundPending], true)) {
            return;
        }
        $stillPaid = $appointment->payments()->where('status', TransactionStatus::Paid)->exists();
        $appointment->update(['payment_status' => $stillPaid ? PaymentStatus::RefundPending : PaymentStatus::Refunded]);
    }
}
