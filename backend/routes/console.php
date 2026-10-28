<?php

use Illuminate\Support\Facades\Schedule;

// Run `php artisan schedule:work` (dev) or a cron calling `schedule:run` every minute (prod)
Schedule::command('appointments:expire')->everyMinute()->withoutOverlapping();
Schedule::command('appointments:remind')->everyFifteenMinutes()->withoutOverlapping();
Schedule::command('sanctum:prune-expired --hours=24')->daily();
