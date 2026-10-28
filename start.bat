@echo off
setlocal
rem One-click local demo: API on 127.0.0.1:8000, UI on http://localhost:5173
title Clinic booking - setup

where php >nul 2>&1 || (echo [X] PHP not found. Install PHP 8.3+ and add it to PATH. & goto :fail)
where composer >nul 2>&1 || (echo [X] Composer not found. Install it from getcomposer.org. & goto :fail)
where node >nul 2>&1 || (echo [X] Node.js not found. Install Node 20.19+ from nodejs.org. & goto :fail)

php -r "exit(version_compare(PHP_VERSION,'8.3.0','>=')?0:1);" || (echo [X] PHP 8.3 or newer is required. & php -v & goto :fail)
for %%E in (pdo_sqlite sqlite3 mbstring openssl fileinfo curl) do (
  php -r "exit(extension_loaded('%%E')?0:1);" || (echo [X] PHP extension "%%E" is not enabled. Open php.ini, remove the ; before extension=%%E, then run this again. & php --ini & goto :fail)
)

cd /d "%~dp0backend"
if not exist vendor\autoload.php (
  echo == Installing backend packages...
  call composer install --no-interaction || (echo [X] composer install failed. & goto :fail)
)
if not exist .env copy .env.example .env >nul
rem An earlier failed run can leave .env without a key
findstr /r /c:"^APP_KEY=base64:" .env >nul || (php artisan key:generate -n --force || goto :fail)
rem The marker is written only after a successful seed, so a half-made database is rebuilt
if not exist database\.seeded (
  echo == Creating the demo database...
  if exist database\database.sqlite del database\database.sqlite
  type nul > database\database.sqlite
  php artisan migrate:fresh --seed -n --force || (echo [X] Database setup failed. & goto :fail)
  type nul > database\.seeded
)

cd /d "%~dp0frontend"
if not exist node_modules (
  echo == Installing frontend packages...
  call npm install --legacy-peer-deps || (echo [X] npm install failed. & goto :fail)
)

start "API" cmd /k "cd /d %~dp0backend && php artisan serve --host=127.0.0.1 --port=8000"
start "Queue" cmd /k "cd /d %~dp0backend && php artisan queue:work --sleep=1"
start "Scheduler" cmd /k "cd /d %~dp0backend && php artisan schedule:work"
start "UI" cmd /k "cd /d %~dp0frontend && npm run dev"

echo == Waiting for the API...
for /l %%i in (1,1,30) do (
  curl -sf -o nul http://127.0.0.1:8000/api/v1/specialties && goto :ready
  timeout /t 1 >nul
)
echo [X] The API did not start. Check the "API" window, or backend\storage\logs\laravel.log
goto :fail

:ready
timeout /t 3 >nul
start http://localhost:5173
echo == Running. Close the 4 windows to stop.
pause
exit /b 0

:fail
echo.
echo Setup stopped. Send a screenshot of this window.
pause
exit /b 1
