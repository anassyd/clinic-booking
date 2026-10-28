<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            // Desk payments: who took the money and the POS receipt / transfer number
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reference', 100)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('received_by');
            $table->dropColumn('reference');
        });
    }
};
