<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('doctors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->foreignId('specialty_id')->constrained()->restrictOnDelete();
            $table->json('name');
            $table->json('title')->nullable();
            $table->json('bio')->nullable();
            $table->string('photo')->nullable();
            $table->unsignedSmallInteger('years_of_experience')->default(0);
            $table->decimal('rating', 2, 1)->default(0);
            $table->unsignedInteger('consultation_price'); // SAR, VAT-inclusive
            $table->unsignedInteger('follow_up_price')->default(0); // 0 = free
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('doctor_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('doctor_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('day_of_week'); // 0 = Sunday … 6 = Saturday
            $table->time('start_time');
            $table->time('end_time');
            $table->unique(['doctor_id', 'day_of_week']);
        });

        Schema::create('doctor_time_off', function (Blueprint $table) {
            $table->id();
            // null doctor = the whole center is closed (public holiday)
            $table->foreignId('doctor_id')->nullable()->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->time('start_time')->nullable(); // null = full day
            $table->time('end_time')->nullable();
            $table->string('reason')->nullable();
            $table->timestamps();
            $table->index(['doctor_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('doctor_time_off');
        Schema::dropIfExists('doctor_schedules');
        Schema::dropIfExists('doctors');
    }
};
