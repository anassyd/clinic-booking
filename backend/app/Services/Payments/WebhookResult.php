<?php

namespace App\Services\Payments;

final readonly class WebhookResult
{
    public function __construct(
        public string $orderId,
        public bool $success,
        public ?string $transactionId,
        public array $payload,
        public bool $isRefund = false,
    ) {}
}
