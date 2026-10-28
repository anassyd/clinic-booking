# Clinic booking — project context

Medical-center booking system for **Saudi Arabia**. React frontend (`frontend/`) + Laravel API (`backend/`).
The owner writes in Egyptian Arabic; answer in the same. UI copy is Arabic MSA (default, RTL) + English.

## Run

- `start.bat` (Windows) / `./start.sh` — installs deps, seeds a SQLite demo DB once (`backend/database/.seeded` marker),
  starts API (127.0.0.1:8000), queue worker, scheduler and Vite (http://localhost:5173, proxies `/api`).
- Reset demo data: `cd backend && php artisan migrate:fresh --seed`.
- Demo logins (password `password`): admin@ / staff@ / doctor@ / patient@demo.test (doctor2–10@demo.test too).
- Mail and WhatsApp use log drivers → links and messages land in `backend/storage/logs/laravel.log`.
- Online payment uses `FakeGateway` (signed `payments.fake` page) unless Moyasar keys are set.

## Checks before calling work done

- Backend: `cd backend && php artisan test --compact` (73 feature tests; the Hijri notification test is skipped without the PHP `intl` extension — messages then carry the Gregorian date only) and `vendor/bin/pint --dirty --format agent`.
- Frontend: `cd frontend && npx tsc -b && npm run build`.
- See `backend/CLAUDE.md` (Laravel Boost guidelines) for backend conventions.

## Business rules (defaults in `backend/config/clinic.php`, admin-overridable via settings table)

- 5 specialties × 2 doctors, 30-min slots computed from each doctor's own schedule (never stored). Friday off.
- Patients book ≥ 24 h ahead, ≤ 30 days out; staff/doctors can book same day.
- One active consultation per patient per day; one account can book for several family members.
- Online payment holds the slot 15 min then auto-confirms (no staff confirmation). Cash bookings wait for reception,
  auto-cancel after 12 h or 6 h before the visit. Max 5 pending per account.
- Patients reschedule/cancel until 3 h before; a paid cancellation refunds in full. A gateway-refused refund keeps
  the cancellation, sets payment `refund_pending`, and admins retry from Admin → Refunds.
- Doctors book only into their own schedule (confirmed, paid at the desk later). Finishing a visit the doctor may book
  the follow-up ("مراجعة") right away (`follow_up: {due, start}`) or only request it **by a date** + note
  (`follow_up: {due, note}` → `appointments.follow_up_due/_note`). Open requests (`awaitingFollowUp` scope:
  no non-cancelled child, not dismissed) show in reception's "طلبات المراجعة" and the patient's /my; either books it via
  `follow_up_of` under the normal booking rules, price per doctor (may be free). Reception can dismiss a request.
- Header bell (receptionist + doctor only): `StaffAlerts` service → `StaffAlert` database notifications; reception
  hears what patients do (new cash booking, cancel, reschedule) + doctors' follow-up requests; a doctor hears changes to
  their today/tomorrow schedule not made by them. `GET /notifications`, polled every 30 s (no websockets).
- Reminders by WhatsApp + email, 24 h before. Patients must verify email before the first booking; password reset by email.
- Saudi specifics: Asia/Riyadh, SAR (Moyasar in halalas), mobile `05XXXXXXXX` (→ `9665…` for WhatsApp),
  National ID / Iqama `^[12]\d{9}$`, Hijri dates (umm al-qura) shown next to Gregorian, Arabic-Indic digits,
  `vat_rate` setting (prices VAT-inclusive, currently 0).

## Code map

- Backend: `app/Services/SlotService.php`, `BookingService.php` (every status change via `transition()` → history),
  `Services/Payments/*` (`PaymentGateway` interface: Fake / Moyasar; `PaymentService`), `Support/ClinicSettings.php`,
  `BookingException` → 422 `{code, message}` localized in `lang/{ar,en}/booking.php`. API under `/api/v1`, Sanctum
  bearer tokens, camelCase API Resources. Double booking guarded by a doctor row lock + unique index on
  `(doctor_id, date, start_time, active_slot)`. Appointment `date` is a plain `Y-m-d` string (no cast).
- Frontend: Vite 8 / React 19 / TS, Tailwind v4 + shadcn (logical RTL classes), motion + GSAP, TanStack Query,
  i18next (`src/i18n/{ar,en}.ts`, helpers in `src/i18n/index.ts`: `fdate`, `hijri`, `wday`, `num`, `money`, `time`).
  API client `src/lib/api.ts` + `src/lib/admin-api.ts`, fetch wrapper `src/lib/http.ts`, errors `src/lib/errors.ts`.
  Pages in `src/pages/{public,booking,patient,staff,doctor,admin}`; routes in `src/router.tsx`.
- Design skills in `.claude/skills` (ui-ux-pro-max etc.).
- SRS (Arabic, kept up to date with the code): https://claude.ai/artifact/UnLtDoRArgQLrojZFWWJ6m
- User guide = PDF `docs/دليل-استخدام-نظام-الحجز.pdf` (38 A4 pages, Arabic, one section per role, numbered orange
  callouts + arrows drawn on each screenshot). Regenerate with `tools/guide/`: `guide-capture.mjs` (playwright-core
  ≥1.56 + installed Edge; serve the API on :8000 against a COPY of the demo DB and Vite on :5173) records each
  step's element box → `build.py` lays out the pages and draws the callouts → `render-pdf.mjs` prints the PDF.
  The older Claude Docs guide (https://claude.ai/artifact/SbgTwYX2hdCiPTo6gPdyC7) was rejected by the owner.
- API scenario suite (71 end-to-end checks, all roles): `tools/qa/scenarios.py` — run it against a COPY of the demo DB
  served on :8010 (`DB_DATABASE=<copy> php -S 127.0.0.1:8010 -t public public/index.php`), never the live demo DB.
- Explainer video narration (Egyptian Arabic, for Google Flash TTS): `docs/explainer-script.md`.

## Waiting on the owner

- VAT registration (15%?) and ZATCA e-invoicing.
- Moyasar merchant account; Meta Business / WhatsApp number + 7 templates (names in README).
- Real prices per doctor (seed uses 350 / 400 / 250 SAR), PDPL / hosting review, domain, GitHub repo.

## Desk payments (built 2026-10-27)

- Methods: `online` (Moyasar), and at the desk `cash`, `card` (mada/POS, Apple Pay), `transfer`. Owner decided: no
  Tabby/Tamara. A patient's "cash" choice means "pay at the clinic"; the real desk method is set when reception collects.
- Staff quick book (receptionist/admin, not doctors): **pay now** (`payment: {method, reference}` on `POST /appointments`)
  or **pay on arrival** → `PATCH /staff/appointments/{id}/paid` with `{method, reference}` (Collect dialog).
  Reference optional for card, required for transfer (`DeskPaymentRequest`). Payment rows store `received_by` + `reference`.
- Reception dashboard: patient search (name / mobile / partial National ID) with their visits (`/staff/appointments?patient_id=`),
  "حجز" button on free future slots → quick book prefilled, separate age column.
- Open questions: add insurance (2 phases proposed) to "waiting on the owner"? landing upgrade (Arabic heading font,
  search bar, real nearest slots)? `FRONTEND_URL` for phone testing of payment links?
- Next (agreed, not built): daily cash-drawer close per staff by method, admin revenue split by method, and
  "refund X SAR due" on cancelling a desk-paid booking (today desk payments are marked refunded immediately).
- Deferred: Moyasar payment link for phone bookings, printed receipt (ZATCA), staff discounts/waivers.
