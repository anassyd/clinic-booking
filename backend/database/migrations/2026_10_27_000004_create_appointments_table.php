<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('doctor_id')->constrained()->restrictOnDelete();
            $table->foreignId('patient_id')->constrained()->restrictOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('appointments')->nullOnDelete();
            $table->string('type', 20)->default('consultation');
            $table->date('date');
            $table->string('start_time', 5); // HH:MM
            $table->string('end_time', 5);
            $table->string('status', 20)->index();
            $table->unsignedInteger('price');
            $table->string('payment_method', 10);
            $table->string('payment_status', 10)->default('unpaid');

            $table->timestamp('hold_expires_at')->nullable();
            $table->timestamp('pending_expires_at')->nullable();
            $table->timestamp('reminder_sent_at')->nullable();

            $table->foreignId('booked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('booked_by_role', 20);
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('confirmed_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancel_reason')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            // 1 while the appointment occupies its slot, NULL once cancelled. NULLs never
            // collide in a unique index, so this is the last line of defence against double booking.
            $table->unsignedTinyInteger('active_slot')->nullable()->storedAs(
                "CASE WHEN status IN ('held','pending','confirmed','completed','no_show') THEN 1 ELSE NULL END"
            );
            $table->unique(['doctor_id', 'date', 'start_time', 'active_slot'], 'appointments_slot_unique');

            $table->index(['doctor_id', 'date']);
            $table->index(['patient_id', 'date']);
            $table->index(['status', 'pending_expires_at']);
            $table->index(['status', 'hold_expires_at']);
        });

        Schema::create('appointment_status_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('appointment_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 20)->nullable();
            $table->string('to_status', 20);
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reason')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointment_status_history');
        Schema::dropIfExists('appointments');
    }
};
