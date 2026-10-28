<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            // Set when the gateway rejects a refund; cleared once a retry succeeds (NFR-12)
            $table->text('refund_error')->nullable();
            $table->unsignedSmallInteger('refund_attempts')->default(0);
            $table->timestamp('refund_failed_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['refund_error', 'refund_attempts', 'refund_failed_at']);
        });
    }
};
