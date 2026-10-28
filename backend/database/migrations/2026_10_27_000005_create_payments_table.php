<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('appointment_id')->constrained()->cascadeOnDelete();
            $table->string('method', 10);
            $table->unsignedInteger('amount'); // SAR (whole riyals)
            $table->string('currency', 3)->default('SAR');
            $table->string('status', 10)->default('pending');
            $table->string('gateway', 20);
            $table->string('gateway_order_id')->nullable()->unique(); // webhooks are applied once
            $table->string('gateway_txn_id')->nullable();
            $table->json('raw_payload')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
