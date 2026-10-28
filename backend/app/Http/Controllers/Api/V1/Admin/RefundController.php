<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\TransactionStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\AppointmentResource;
use App\Models\Payment;
use App\Services\Payments\PaymentService;
use Illuminate\Http\JsonResponse;

/** Refunds the gateway rejected — the cancellation stands, the money still has to go back (NFR-12). */
class RefundController extends Controller
{
    public function index(): JsonResponse
    {
        $payments = Payment::query()
            ->where('status', TransactionStatus::Paid)
            ->whereNotNull('refund_failed_at')
            ->with('appointment.patient', 'appointment.doctor')
            ->orderBy('refund_failed_at')
            ->get();

        return response()->json(['data' => $payments->map(fn (Payment $p) => $this->present($p))]);
    }

    public function retry(Payment $payment, PaymentService $payments): JsonResponse
    {
        abort_if($payment->status !== TransactionStatus::Paid, 422, __('booking.errors.invalid_transition'));
        $ok = $payments->retryRefund($payment);

        return response()->json(['ok' => $ok, 'data' => $this->present($payment->refresh()->load('appointment.patient', 'appointment.doctor'))], $ok ? 200 : 502);
    }

    private function present(Payment $p): array
    {
        return [
            'id' => $p->id,
            'amount' => $p->amount,
            'gateway' => $p->gateway,
            'status' => $p->status,
            'error' => $p->refund_error,
            'attempts' => $p->refund_attempts,
            'failedAt' => $p->refund_failed_at?->toIso8601String(),
            'appointment' => new AppointmentResource($p->appointment),
        ];
    }
}
