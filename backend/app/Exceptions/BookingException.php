<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;

/**
 * A broken business rule. Rendered as 422 with a stable machine code the
 * frontend translates (slot_taken, daily_limit_reached, …).
 */
class BookingException extends Exception
{
    public function __construct(public readonly string $errorCode, private readonly int $status = 422)
    {
        parent::__construct($errorCode);
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'code' => $this->errorCode,
            'message' => __("booking.errors.{$this->errorCode}"),
        ], $this->status);
    }
}
