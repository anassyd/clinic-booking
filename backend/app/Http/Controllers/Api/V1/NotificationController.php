<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

/** The header bell for reception and doctors (App\Notifications\StaffAlert). */
class NotificationController extends Controller
{
    // GET /notifications — the latest 30, newest first, plus the unread count
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'data' => $user->notifications()->limit(30)->get()->map(fn (DatabaseNotification $n) => [
                'id' => $n->id,
                'event' => $n->type,
                'data' => $n->data,
                'readAt' => $n->read_at?->toIso8601String(),
                'createdAt' => $n->created_at->toIso8601String(),
            ]),
            'meta' => ['unread' => $user->unreadNotifications()->count()],
        ]);
    }

    // PATCH /notifications/{id}/read
    public function read(Request $request, string $id): JsonResponse
    {
        $request->user()->notifications()->whereKey($id)->firstOrFail()->markAsRead();

        return response()->json(['ok' => true]);
    }

    // POST /notifications/read-all
    public function readAll(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
    }
}
