# Shifaa Medical Center — Appointment Booking

Bilingual (Arabic RTL / English) booking system for a 5-specialty, 10-doctor clinic in Saudi Arabia, built from the project SRS.
Riyadh time (UTC+3), prices in SAR, Saudi mobiles (`05XXXXXXXX`), optional National ID / Iqama, Gregorian + Hijri (Umm al-Qura) dates, Modern Standard Arabic copy.

## Status

| Part | State |
| --- | --- |
| `frontend/` — React app | Done: landing, auth, booking wizard, patient, reception and doctor consoles — wired to the API (`src/lib/api.ts`, `src/lib/http.ts`) |
| `backend/` — Laravel 13 API | Done: all SRS endpoints, rules, Moyasar, WhatsApp + email, scheduler, admin, reports. 47 feature tests |
| Admin screens | Done: reports (occupancy chart, CSV), doctors + weekly schedules, specialties, time off, staff accounts, settings |

## Run the backend

```bash
cd backend
composer install
cp .env.example .env && php artisan key:generate   # .env already exists in this checkout
touch database/database.sqlite                        # SQLite for dev; set DB_* for MySQL in prod
php artisan migrate --seed                            # 5 specialties, 10 doctors, demo users, ~2k bookings
php artisan serve                                     # http://localhost:8000/api/v1
php artisan queue:work                                # sends notifications (incl. verify / reset emails)
php artisan schedule:work                             # expiry every minute, reminders every 15 min
php artisan test                                      # 47 tests
```

Demo logins (password `password`): `patient@demo.test`, `staff@demo.test`, `admin@demo.test`,
`doctor@demo.test` (Dr. Ahmed Mansour) and `doctor2@demo.test` … `doctor10@demo.test`.

### Going live

| Service | .env | Notes |
| --- | --- | --- |
| Moyasar | `PAYMENT_DRIVER=moyasar`, `MOYASAR_SECRET_KEY`, `MOYASAR_PUBLISHABLE_KEY`, `MOYASAR_WEBHOOK_SECRET` | Hosted invoice page (mada, Apple Pay, STC Pay, cards). Add a webhook to `POST /api/v1/webhooks/moyasar` with the same secret token. Amounts are sent in halalas. Check the invoice/webhook fields in `app/Services/Payments/MoyasarGateway.php` against docs.moyasar.com before launch |
| VAT | `PUT /api/v1/admin/settings {"vat_rate": 15}` | Default 0. Prices are VAT-inclusive; each appointment returns `vatAmount`. ZATCA e-invoicing is not implemented |
| WhatsApp Cloud API | `WHATSAPP_DRIVER=cloud`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | Webhook: `GET/POST /api/v1/webhooks/whatsapp`. Create these templates in **ar** and **en**, body params `{{1}}` patient, `{{2}}` doctor, `{{3}}` date, `{{4}}` time: `appointment_pending`, `appointment_confirmed`, `appointment_reminder`, `appointment_rescheduled`, `appointment_cancelled`, `visit_completed`, and `follow_up_requested` (only `{{1}}` patient, `{{2}}` doctor, `{{3}}` follow-up-by date) |
| Mail | `MAIL_*` | Any SMTP/SES/Mailgun |
| Cron | `* * * * * php artisan schedule:run` | Plus a supervised `queue:work` |

### Where the rules live

- `config/clinic.php` — defaults (24 h lead, 3 h cutoff, 12 h / 6 h pending expiry, 15 min hold, 5 pending, Friday off); admins override them via `PUT /api/v1/admin/settings`.
- `app/Services/SlotService.php` — slots computed from schedules − time off − bookings.
- `app/Services/BookingService.php` — every status change, with history (`appointment_status_history`).
- Double booking: a row lock per doctor plus a unique index on `(doctor_id, date, start_time, active_slot)`, where `active_slot` is a generated column that is NULL once cancelled.

## Run the frontend

```bash
cd frontend
npm install --legacy-peer-deps   # @hookform/resolvers has an optional peer conflict
npm run dev                      # http://localhost:5173 — needs the backend on :8000 (Vite proxies /api)
npm run build                    # set VITE_API_URL for production, see .env.example
```

In dev the sign-in page has one-click demo accounts (they log in through the API with the seeded
password; seeded users are already email-verified). `php artisan migrate:fresh --seed` resets the demo data.
With `MAIL_MAILER=log` the verification and reset links land in `backend/storage/logs/laravel.log`.

How the client talks to the API:
- Bearer token from `POST /auth/login` in localStorage; a 401 clears it and signs the user out.
- `Accept-Language` follows the UI language, so server errors arrive in Arabic or English.
- Specialties and doctors load once at boot; if the API is down the app shows a retry screen.
- Online bookings redirect to the gateway's hosted page, which returns to `/my?payment=<id>`;
  the page reports the status the server recorded (the webhook decides, not the redirect).

## Stack

| Concern | Library | Why |
| --- | --- | --- |
| Build | Vite 8 + React 19 + TypeScript | Fast dev server, route-level code splitting |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix, new-york-v4) | Accessible primitives, tokens in `src/index.css`, logical (RTL-safe) classes |
| Design system | UI/UX Pro Max skill (`.claude/skills/ui-ux-pro-max`) | Healthcare palette (teal + health green), Figtree / Noto Sans Arabic, checklist |
| Micro-interactions & layout | Motion (Framer Motion) | Page/step transitions, shared-layout tabs, list enter/exit, `reducedMotion="user"` |
| Timelines & scroll | GSAP + ScrollTrigger + `@gsap/react` | Hero timeline, scroll-scrubbed progress line, count-ups, success check; all inside `gsap.matchMedia` for reduced motion |
| Data fetching | TanStack Query | Caching, invalidation after mutations |
| Forms | React Hook Form + Zod | Saudi mobile / National ID / email / birth-date validation with translated messages |
| i18n | i18next + react-i18next | `ar` (default, RTL, MSA) and `en`; Arabic-Indic digits; Hijri dates via `Intl` (`islamic-umalqura`) |
| Dates | date-fns (`arSA` / `enUS`) | Week starts Saturday, Friday off |
| Icons | lucide-react | One stroke icon set, no emoji |

## Business rules (`backend/config/clinic.php`)

- 30-minute slots from each doctor's own schedule; Friday closed.
- Patients book ≥ 24 h ahead and ≤ 30 days out; staff and doctors can book same day.
- One active consultation per patient per day; an account can book for several family members.
- Online payment holds the slot for 15 min, then auto-confirms; cash bookings wait for reception and auto-cancel after 12 h or 6 h before the visit.
- Patients can reschedule/cancel until 3 h before; cancelling a paid booking refunds in full.
- Doctors book into their own schedule. Finishing a visit they either book the follow-up right away or ask for one by a date; a request shows in reception's follow-up list and in the patient's account, and either one books it like any other appointment (normal rules, price set per doctor, may be free).
- Patients confirm their email before their first booking (signed 48 h link → `/verify-email`); password reset by email (`/forgot-password` → `/reset-password`, link valid 60 min, single use).
- If the gateway refuses a refund, the cancellation stands and the payment shows `refund_pending`; admins retry it from **Admin → Refunds** (`GET /api/v1/admin/refunds`, `POST /api/v1/admin/refunds/{payment}/retry`).

## Notes

- `ui.shadcn.com` and `21st.dev` were blocked by this environment's network policy, so shadcn components were copied from the official `shadcn-ui/ui` GitHub registry (`apps/v4/registry/new-york-v4/ui`) and converted to logical RTL classes. The 21st.dev MCP server was not added (no `API_KEY_21ST` and the host is blocked).
