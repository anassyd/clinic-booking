"""End-to-end API scenarios against the isolated QA server (copy of the demo DB on :8010)."""
import json, sys, urllib.request, urllib.error, datetime as dt, random, string

BASE = "http://127.0.0.1:8010/api/v1"
results = []


def call(method, path, token=None, body=None, raw=False, lang="ar"):
    url = path if path.startswith("http") else BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/json")
    req.add_header("Accept-Language", lang)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    try:
        r = opener.open(req, timeout=30)
        status, text = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        status, text = e.code, e.read().decode()
    if status == 429 and not getattr(call, "_retrying", False):
        # booking is rate-limited to 10/min per account; wait it out once
        import time
        time.sleep(62)
        call._retrying = True
        try:
            return call(method, path, token, body, raw, lang)
        finally:
            call._retrying = False
    if raw:
        return status, text
    try:
        return status, json.loads(text) if text else {}
    except ValueError:
        return status, {"_raw": text[:300]}


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  -> {detail}"))


def login(email):
    s, j = call("POST", "/auth/login", body={"email": email, "password": "password"})
    assert s == 200, (email, s, j)
    return j["token"], j["user"]


today = dt.date.today()
d = lambda n: (today + dt.timedelta(days=n)).isoformat()


def working_day(start, doctor=1, token=None, need_free=True):
    """First non-Friday day >= today+start where the doctor has a free slot (as seen by token's role)."""
    for n in range(start, start + 20):
        day = today + dt.timedelta(days=n)
        if day.weekday() == 4:  # Friday
            continue
        s, j = call("GET", f"/doctors/{doctor}/slots?date={day.isoformat()}", token)
        free = [x["start"] for x in j.get("data", []) if x["available"]]
        if free or not need_free:
            return day.isoformat(), free
    raise RuntimeError("no free day")


# ---------------------------------------------------------------- accounts
pt, puser = login("patient@demo.test")
st, suser = login("staff@demo.test")
dtok, duser = login("doctor@demo.test")
at, auser = login("admin@demo.test")
DOC = duser["doctorId"]
check("login: all four demo roles", all([pt, st, dtok, at]))

s, fam = call("GET", "/patients", pt)
family = [p["id"] for p in fam["data"]]
check("patient: lists family members", s == 200 and len(family) >= 1, (s, fam))

# a fresh family member for clean daily-limit tests
def new_family_member(token, name="مريض اختبار"):
    body = {"name": name + " " + "".join(random.choices(string.ascii_letters, k=4)), "email": "qa@example.com",
            "phone": "05" + "".join(random.choices(string.digits, k=8)), "birth_date": "1990-05-01", "gender": "male"}
    s, j = call("POST", "/patients", token, body)
    assert s == 201, (s, j)
    return j["data"]["id"]

p1 = new_family_member(pt)
p2 = new_family_member(pt)

# ---------------------------------------------------------------- patient booking rules
day_today, free_today = working_day(0, DOC, st)
s, j = call("POST", "/appointments", pt, {"doctor_id": DOC, "patient_id": p1, "date": day_today, "start": free_today[-1], "payment_method": "cash"})
check("patient: same-day booking refused (24h lead time)", s == 422 and j.get("code") == "lead_time_violation", (s, j))

far = today + dt.timedelta(days=35)
while far.weekday() == 4:
    far += dt.timedelta(days=1)
s, j = call("POST", "/appointments", pt, {"doctor_id": DOC, "patient_id": p1, "date": far.isoformat(), "start": "10:00", "payment_method": "cash"})
check("patient: >30 days ahead refused", s == 422 and j.get("code") == "too_far_ahead", (s, j))

fri = today + dt.timedelta(days=(4 - today.weekday()) % 7 + 7)
s, j = call("POST", "/appointments", pt, {"doctor_id": DOC, "patient_id": p1, "date": fri.isoformat(), "start": "10:00", "payment_method": "cash"})
check("patient: Friday refused", s == 422 and j.get("code") == "day_off", (s, j))

dayA, freeA = working_day(3, DOC, pt)
s, j = call("POST", "/appointments", pt, {"doctor_id": DOC, "patient_id": p1, "date": dayA, "start": freeA[0][:3] + "15", "payment_method": "cash"})
check("patient: off-grid time refused", s == 422 and j.get("code") == "invalid_slot", (s, j))

s, j = call("POST", "/appointments", pt, {"doctor_id": DOC, "patient_id": p1, "date": dayA, "start": freeA[0], "payment_method": "cash", "notes": "QA"})
cashA = j.get("data", {})
check("patient: cash booking → pending with auto-cancel deadline", s == 201 and cashA.get("status") == "pending" and cashA.get("pendingExpiresAt"), (s, j))

other_doc = 3 if DOC != 3 else 4
s, freeOther = call("GET", f"/doctors/{other_doc}/slots?date={dayA}", pt)
fo = [x["start"] for x in freeOther.get("data", []) if x["available"]]
if fo:
    s, j = call("POST", "/appointments", pt, {"doctor_id": other_doc, "patient_id": p1, "date": dayA, "start": fo[0], "payment_method": "cash"})
    check("patient: second visit same day refused", s == 422 and j.get("code") == "daily_limit_reached", (s, j))

s, j = call("POST", "/appointments", pt, {"doctor_id": DOC, "patient_id": p2, "date": dayA, "start": freeA[0], "payment_method": "cash"})
check("patient: taken slot refused", s == 422 and j.get("code") == "slot_taken", (s, j))

s, j = call("POST", "/appointments", pt, {"doctor_id": DOC, "patient_id": p2, "date": dayA, "start": freeA[1], "payment_method": "cash",
                                          "payment": {"method": "cash"}})
check("patient: cannot send desk payment", s == 422, (s, j))

# online booking + fake checkout
s, j = call("POST", "/appointments", pt, {"doctor_id": DOC, "patient_id": p2, "date": dayA, "start": freeA[1], "payment_method": "online"})
held = j.get("data", {})
check("patient: online booking → held + payment URL", s == 201 and held.get("status") == "held" and j.get("paymentUrl"), (s, j))
if j.get("paymentUrl"):
    s, _ = call("GET", j["paymentUrl"], raw=True)
    check("fake gateway: checkout redirects back", s in (301, 302, 303), s)
    s, j = call("GET", f"/appointments/{held['id']}", pt)
    check("online: confirmed + paid after checkout", j["data"]["status"] == "confirmed" and j["data"]["paymentStatus"] == "paid", j.get("data"))

# reschedule then cancel
dayB, freeB = working_day(5, DOC, pt)
if dayB == dayA:
    dayB, freeB = working_day(6, DOC, pt)
s, j = call("PATCH", f"/appointments/{cashA['id']}/reschedule", pt, {"date": dayB, "start": freeB[0]})
check("patient: reschedule", s == 200 and j["data"]["date"] == dayB, (s, j))
s, j = call("PATCH", f"/appointments/{cashA['id']}/cancel", pt, {})
check("patient: cancel (no reason needed)", s == 200 and j["data"]["status"] == "cancelled", (s, j))
s, j = call("PATCH", f"/appointments/{cashA['id']}/cancel", pt, {})
check("patient: cancelling twice refused", s == 422, (s, j))

s, j = call("PATCH", f"/appointments/{held['id']}/cancel", pt, {"reason": "QA"})
check("patient: cancel paid online → refunded", s == 200 and j["data"]["paymentStatus"] in ("refunded", "refund_pending"), (s, j.get("data", {}).get("paymentStatus")))

# pending limit (5 per account)
made = []
n = 2
codes = []
while len(made) < 7 and n < 28:
    day = today + dt.timedelta(days=n)
    n += 1
    if day.weekday() == 4:
        continue
    pid = new_family_member(pt)
    s2, sl = call("GET", f"/doctors/{DOC}/slots?date={day.isoformat()}", pt)
    free = [x["start"] for x in sl.get("data", []) if x["available"]]
    if not free:
        continue
    s, j = call("POST", "/appointments", pt, {"doctor_id": DOC, "patient_id": pid, "date": day.isoformat(), "start": free[0], "payment_method": "cash"})
    codes.append(s if s == 201 else j.get("code"))
    if s == 201:
        made.append(j["data"]["id"])
    else:
        break
check("patient: 6th pending booking refused (max 5)", "pending_limit_reached" in codes, codes)

# access control
s, j = call("GET", "/staff/pending", pt)
check("patient: staff endpoints forbidden", s == 403, s)
s, j = call("GET", "/admin/settings", st)
check("reception: admin endpoints forbidden", s == 403, s)
s, j = call("GET", "/appointments/my")
check("guest: my appointments → 401", s == 401, s)
s, other = call("GET", f"/staff/appointments?from={d(1)}&to={d(1)}", st)
foreign = next((a for a in other.get("data", []) if a["patientId"] not in family and a["patientId"] not in (p1, p2)), None)
if foreign:
    s, j = call("GET", f"/appointments/{foreign['id']}", pt)
    check("patient: someone else's appointment forbidden", s == 403, s)
    s, j = call("PATCH", f"/appointments/{foreign['id']}/cancel", pt, {})
    check("patient: cannot cancel someone else's appointment", s == 403, s)

# unverified email
email = "qa_" + "".join(random.choices(string.ascii_lowercase, k=6)) + "@example.com"
s, reg = call("POST", "/auth/register", body={"name": "QA User", "email": email, "phone": "0512345678", "password": "password123",
                                              "password_confirmation": "password123", "gender": "female", "birth_date": "1995-01-01"})
check("register: new patient", s in (200, 201), (s, reg))
if s in (200, 201):
    ut = reg["token"]
    s, fam2 = call("GET", "/patients", ut)
    pid = fam2["data"][0]["id"] if fam2.get("data") else None
    if pid:
        s, j = call("POST", "/appointments", ut, {"doctor_id": DOC, "patient_id": pid, "date": dayB, "start": freeB[-1], "payment_method": "cash"})
        check("unverified email: booking refused", s == 403 and j.get("code") == "email_unverified", (s, j))

# ---------------------------------------------------------------- reception
s, j = call("GET", "/staff/pending", st)
check("reception: pending queue", s == 200 and any(a["id"] in made for a in j["data"]), len(j.get("data", [])))
if made:
    s, j = call("PATCH", f"/staff/appointments/{made[0]}/confirm", st)
    check("reception: confirm pending", s == 200 and j["data"]["status"] == "confirmed", (s, j))
    s, j = call("PATCH", f"/staff/appointments/{made[0]}/confirm", st)
    check("reception: confirming twice refused", s == 422, s)

s, found = call("GET", "/patients/search?q=050", st)
check("reception: search by phone prefix", s == 200 and len(found.get("data", [])) > 0, s)
s, found = call("GET", "/patients/search?q=" + urllib.parse.quote("مريض"), st) if hasattr(urllib, "parse") else (0, {})
import urllib.parse
s, found = call("GET", "/patients/search?q=" + urllib.parse.quote("مريض اختبار"), st)
check("reception: search by Arabic name", s == 200 and len(found.get("data", [])) > 0, (s, found))

s, sl = call("GET", f"/doctors/{DOC}/slots?date={day_today}", st)
free_now = [x["start"] for x in sl["data"] if x["available"]]
walk = new_family_member(pt, "زائر")
s, j = call("POST", "/appointments", st, {"doctor_id": DOC, "patient_id": walk, "date": day_today, "start": free_now[0], "payment": {"method": "transfer"}})
check("reception: transfer without reference refused", s == 422 and "payment.reference" in j.get("errors", {}), (s, j))
s, j = call("POST", "/appointments", st, {"doctor_id": DOC, "patient_id": walk, "date": day_today, "start": free_now[0], "payment": {"method": "card"}})
check("reception: same-day quick book, card paid now", s == 201 and j["data"]["status"] == "confirmed" and j["data"]["paymentStatus"] == "paid"
      and j["data"]["paymentMethod"] == "card", (s, j))
walkAppt = j.get("data", {})

walk2 = new_family_member(pt, "زائر")
s, j = call("POST", "/appointments", st, {"doctor_id": DOC, "patient_id": walk2, "date": day_today, "start": free_now[1]})
later = j.get("data", {})
check("reception: pay-on-arrival booking unpaid", s == 201 and later.get("paymentStatus") == "unpaid", (s, j))
s, j = call("PATCH", f"/staff/appointments/{later['id']}/paid", st, {"method": "transfer", "reference": "TRX-QA-1"})
check("reception: collect by transfer", s == 200 and j["data"]["paymentStatus"] == "paid" and j["data"]["paymentMethod"] == "transfer", (s, j))
s, j = call("PATCH", f"/staff/appointments/{later['id']}/paid", st, {"method": "cash"})
check("reception: collecting twice refused", s == 422, s)

s, j = call("PATCH", f"/appointments/{later['id']}/cancel", st, {})
check("reception: cancel needs a reason", s == 422, s)

yesterday = today - dt.timedelta(days=1)
s, j = call("POST", "/appointments", st, {"doctor_id": DOC, "patient_id": walk2, "date": yesterday.isoformat(), "start": "10:00"})
check("reception: booking in the past refused", s == 422 and j.get("code") in ("slot_in_past", "day_off"), (s, j))

s, j = call("GET", f"/staff/appointments?patient_id={walk}", st)
check("reception: one patient's visits", s == 200 and any(a["id"] == walkAppt.get("id") for a in j["data"]), s)

# ---------------------------------------------------------------- doctor
s, sl = call("GET", f"/doctors/{DOC}/slots?date={day_today}", dtok)
free_now = [x["start"] for x in sl["data"] if x["available"]]
walk3 = new_family_member(pt, "مراجع")
s, j = call("POST", "/appointments", dtok, {"doctor_id": DOC, "patient_id": walk3, "date": day_today, "start": free_now[0]})
docAppt = j.get("data", {})
check("doctor: books own schedule same day → confirmed, unpaid", s == 201 and docAppt.get("status") == "confirmed" and docAppt.get("paymentStatus") == "unpaid", (s, j))
s, j = call("POST", "/appointments", dtok, {"doctor_id": other_doc, "patient_id": walk3, "date": dayB, "start": "10:00"})
check("doctor: other doctor's schedule forbidden", s == 403, (s, j))
s, j = call("POST", "/appointments", dtok, {"doctor_id": DOC, "patient_id": walk2, "date": day_today, "start": free_now[1], "payment": {"method": "cash"}})
check("doctor: cannot collect payment", s == 422, (s, j))

s, j = call("PATCH", f"/doctor/appointments/{made[0]}/complete", dtok, {})
check("doctor: finishing a future visit refused", s == 422 and j.get("code") == "visit_not_started", (s, j))
s, j = call("PATCH", f"/staff/appointments/{made[0]}/no-show", st)
check("reception: no-show before the visit refused", s == 422 and j.get("code") == "visit_not_started", (s, j))
if len(made) > 1:
    s, j = call("PATCH", f"/doctor/appointments/{made[1]}/complete", dtok, {})
    check("doctor: finishing a pending visit refused", s == 422, (s, j))

fu_day, fu_free = working_day(7, DOC, dtok)
s, j = call("PATCH", f"/doctor/appointments/{docAppt['id']}/complete", dtok, {"follow_up": {"due": fu_day, "start": fu_free[0]}})
check("doctor: finish + book follow-up now", s == 200 and j["data"]["status"] == "completed" and j.get("followUp", {}).get("type") == "follow_up"
      and j["followUp"]["status"] == "confirmed", (s, j))

s, j = call("PATCH", f"/doctor/appointments/{walkAppt['id']}/complete", dtok, {"follow_up": {"due": d(14), "note": "بعد التحليل"}})
check("doctor: finish + request follow-up", s == 200 and j["data"]["followUpDue"] == d(14) and j.get("followUp") is None, (s, j))

s, j = call("PATCH", f"/doctor/appointments/{later['id']}/complete", dtok, {"follow_up": {"due": d(0)}})
check("doctor: follow-up due today refused", s == 422, (s, j))
s, j = call("PATCH", f"/doctor/appointments/{later['id']}/no-show", dtok)
check("doctor: no-show refused before the visit starts", s == 422 and j.get("code") == "visit_not_started", (s, j))

s, j = call("GET", "/staff/pending", dtok)
check("doctor: reception endpoints forbidden", s == 403, s)
s, j = call("GET", f"/doctor/appointments?view=week&date={day_today}", dtok)
check("doctor: week view lists own visits only", s == 200 and all(a["doctorId"] == DOC for a in j["data"]), s)

# ---------------------------------------------------------------- follow-up request booked by reception, then by patient
s, j = call("GET", "/follow-ups", st)
req = next((a for a in j.get("data", []) if a["id"] == walkAppt["id"]), None)
check("reception: sees the new follow-up request", s == 200 and req is not None, s)
s, j = call("GET", "/follow-ups", dtok)
check("doctor: follow-up list forbidden", s == 403, s)
s, sl = call("GET", f"/doctors/{DOC}/slots?date={dayB}", st)
fb = [x["start"] for x in sl["data"] if x["available"]]
s, j = call("POST", "/appointments", st, {"doctor_id": DOC, "patient_id": walk, "date": dayB, "start": fb[0], "follow_up_of": walkAppt["id"]})
check("reception: books the requested follow-up", s == 201 and j["data"]["type"] == "follow_up" and j["data"]["parentId"] == walkAppt["id"], (s, j))
fuBooked = j.get("data", {})
s, j = call("POST", "/appointments", st, {"doctor_id": DOC, "patient_id": walk, "date": dayB, "start": fb[1], "follow_up_of": walkAppt["id"]})
check("reception: same request can't be booked twice", s == 422 and j.get("code") == "invalid_follow_up", (s, j))
s, j = call("PATCH", f"/appointments/{fuBooked['id']}/cancel", st, {"reason": "patient_request"})
s, j = call("GET", "/follow-ups", pt)
check("patient: cancelled follow-up reopens request in their account", any(a["id"] == walkAppt["id"] for a in j.get("data", [])), s)
dayC, freeC = working_day(4, DOC, pt)
s, j = call("POST", "/appointments", pt, {"doctor_id": DOC, "patient_id": walk, "date": dayC, "start": freeC[0], "payment_method": "online", "follow_up_of": walkAppt["id"]})
check("patient: books the follow-up themselves", s == 201 and j["data"]["type"] == "follow_up", (s, j))
if s == 201:
    call("PATCH", f"/appointments/{j['data']['id']}/cancel", pt, {})
s, j = call("PATCH", f"/staff/follow-ups/{walkAppt['id']}/dismiss", st)
check("reception: dismiss request", s == 200, (s, j))

# ---------------------------------------------------------------- bell
s, j = call("GET", "/notifications", st)
events = {n["event"] for n in j.get("data", [])}
check("bell (reception): new_pending + cancelled + rescheduled + follow_up_requested",
      {"new_pending", "cancelled", "rescheduled", "follow_up_requested"} <= events, events)
s, j = call("GET", "/notifications", dtok)
check("bell (doctor): reachable", s == 200, s)
s, j = call("GET", "/notifications", pt)
check("bell: patients forbidden", s == 403, s)
s, j = call("POST", "/notifications/read-all", st)
s, j = call("GET", "/notifications", st)
check("bell: read-all clears unread", j.get("meta", {}).get("unread") == 0, j.get("meta"))

# ---------------------------------------------------------------- admin
s, j = call("GET", "/admin/settings", at)
check("admin: settings", s == 200, s)
s, j = call("PUT", "/admin/settings", at, {"vat_rate": 150})
check("admin: invalid VAT refused", s == 422, s)
s, j = call("GET", f"/admin/reports?from={d(-30)}&to={d(0)}", at)
check("admin: report json", s == 200 and "totals" in j, (s, list(j)[:5]))
s, txt = call("GET", f"/admin/reports?from={d(-30)}&to={d(0)}&format=csv", at, raw=True)
check("admin: report csv", s == 200 and "," in txt[:200], (s, txt[:100]))
s, j = call("GET", f"/admin/reports?from={d(0)}&to={d(-1)}", at)
check("admin: report bad range refused", s == 422, s)
s, j = call("GET", "/admin/refunds", at)
check("admin: refunds", s == 200, s)
s, j = call("GET", "/admin/doctors", at)
check("admin: doctors", s == 200 and len(j["data"]) >= 10, s)
s, j = call("GET", "/admin/staff", at)
check("admin: staff", s == 200, s)
s, j = call("POST", "/admin/staff", at, {"name": "QA Reception", "email": email.replace("qa_", "rx_"), "phone": "0598765432", "role": "receptionist",
                                          "gender": "female", "password": "password123"})
check("admin: add receptionist with gender", s in (200, 201) and j["data"].get("gender") == "female", (s, j))
s, j = call("POST", "/appointments", at, {"doctor_id": DOC, "patient_id": walk2, "date": dayC, "start": freeC[-1], "payment": {"method": "cash"}})
check("admin: quick book + pay now", s == 201 and j["data"]["paymentStatus"] == "paid", (s, j))

# English errors
s, j = call("POST", "/appointments", pt, {"doctor_id": DOC, "patient_id": p1, "date": fri.isoformat(), "start": "10:00"}, lang="en")
check("i18n: errors in English with Accept-Language en", s == 422 and j.get("message", "").isascii(), j.get("message"))

print()
fails = [r for r in results if not r[1]]
print(f"{len(results) - len(fails)}/{len(results)} passed")
sys.exit(1 if fails else 0)
