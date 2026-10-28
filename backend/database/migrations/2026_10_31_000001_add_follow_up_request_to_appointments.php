<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The doctor no longer books the follow-up: finishing a visit records "follow up by <date>",
 * and reception or the patient books it like any other appointment (linked through parent_id).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->string('follow_up_due', 10)->nullable()->after('completed_at');
            $table->string('follow_up_note', 500)->nullable()->after('follow_up_due');
            $table->timestamp('follow_up_closed_at')->nullable()->after('follow_up_note');
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropColumn(['follow_up_due', 'follow_up_note', 'follow_up_closed_at']);
        });
    }
};
