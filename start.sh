#!/usr/bin/env bash
# One-command local demo: API on :8000, UI on http://localhost:5173
set -e
cd "$(dirname "$0")"

cd backend
[ -d vendor ] || composer install --no-interaction
[ -f .env ] || { cp .env.example .env; php artisan key:generate -n; }
if [ ! -f database/database.sqlite ]; then
  touch database/database.sqlite
  php artisan migrate:fresh --seed -n
fi
cd ../frontend
[ -d node_modules ] || npm install --legacy-peer-deps
cd ..

trap 'kill 0' EXIT
(cd backend && php artisan serve --host=127.0.0.1 --port=8000) &
(cd backend && php artisan queue:work --sleep=1) &
(cd backend && php artisan schedule:work) &
(cd frontend && npm run dev) &
sleep 4
echo
echo "  Open http://localhost:5173   (Ctrl+C to stop)"
echo
wait
