<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\NotificationLog;
use App\Models\Payment;
use App\Services\BookingService;
use App\Services\Payments\InvalidWebhookSignature;
use App\Services\Payments\PaymentGateway;
use App\Services\Payments\PaymentService;
use App\Services\Payments\WebhookResult;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class WebhookController extends Controller
{
    public function __construct(
        private readonly PaymentGateway $gateway,
        private readonly PaymentService $payments,
        private readonly BookingService $booking,
    ) {}

    // POST /webhooks/moyasar — the source of truth for payments, never the browser redirect (FR-72)
    public function payment(Request $request): JsonResponse
    {
        try {
            $result = $this->gateway->parseWebhook($request);
        } catch (InvalidWebhookSignature) {
            Log::warning('Rejected payment webhook', ['ip' => $request->ip()]);

            return response()->json(['ok' => false], 401);
        }

        if (! $result->isRefund && ($payment = $this->payments->apply($result))) {
            $this->booking->paymentSucceeded($payment->appointment);
        }

        return response()->json(['ok' => true]);
    }

    // GET /payments/fake/{payment} (signed) — dev gateway "checkout page"
    public function fakeCheckout(Payment $payment): RedirectResponse
    {
        $paid = $this->payments->apply(new WebhookResult($payment->gateway_order_id, true, 'fake_txn_'.$payment->id, ['fake' => true]));
        if ($paid) {
            $this->booking->paymentSucceeded($paid->appointment);
        }

        return redirect()->away(rtrim(config('clinic.frontend_url'), '/').'/my?payment='.$payment->id);
    }

    // GET /webhooks/whatsapp — Meta's subscription handshake
    public function whatsappVerify(Request $request): Response
    {
        abort_unless(
            $request->query('hub_mode') === 'subscribe'
                && hash_equals((string) config('services.whatsapp.verify_token'), (string) $request->query('hub_verify_token')),
            403,
        );

        return response((string) $request->query('hub_challenge'));
    }

    // POST /webhooks/whatsapp — delivery receipts update notification_logs
    public function whatsapp(Request $request): JsonResponse
    {
        $signature = 'sha256='.hash_hmac('sha256', $request->getContent(), (string) config('services.whatsapp.app_secret'));
        if (config('services.whatsapp.driver') === 'cloud' && ! hash_equals($signature, (string) $request->header('X-Hub-Signature-256'))) {
            return response()->json(['ok' => false], 401);
        }

        foreach ($request->input('entry', []) as $entry) {
            foreach ($entry['changes'] ?? [] as $change) {
                foreach ($change['value']['statuses'] ?? [] as $status) {
                    NotificationLog::where('provider_message_id', $status['id'] ?? null)
                        ->update(['status' => $status['status'] ?? 'sent']);
                }
            }
        }

        return response()->json(['ok' => true]);
    }
}
