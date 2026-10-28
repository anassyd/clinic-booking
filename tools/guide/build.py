"""Builds guide.html (A4 pages, RTL) from screens.json + img/*.jpg. Callouts are drawn as SVG over each screenshot."""
import json, math, os, html

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = r"C:/Users/anass/Downloads/clinic-booking/frontend/node_modules/@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-arabic-wght-normal.woff2"
FONT_LATIN = r"C:/Users/anass/Downloads/clinic-booking/frontend/node_modules/@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-latin-wght-normal.woff2"

screens = {s["id"]: s for s in json.load(open(os.path.join(HERE, "screens.json"), encoding="utf8"))}

AR = "٠١٢٣٤٥٦٧٨٩"
def ar(n):
    return "".join(AR[int(c)] if c.isdigit() else c for c in str(n))

esc = html.escape
ORANGE = "#F2611D"
CONTENT_W = 680  # px inside 15mm margins on A4

ROLES = {
    "patient": {"name": "المريض", "color": "#0E7490", "soft": "#E3F2F6",
                "desc": "يحجز موعده بنفسه من الجوال أو الكمبيوتر، لنفسه ولأفراد أسرته، ويدفع إلكترونيًا أو في العيادة، ويتابع مواعيده ويعدّلها.",
                "icon": '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>'},
    "reception": {"name": "موظف الاستقبال", "color": "#2459C9", "soft": "#E6EDFB",
                  "desc": "يدير يوم العيادة: يؤكد الحجوزات، ويحجز للمرضى هاتفيًا وفي العيادة، ويحصّل المبالغ، ويتابع طلبات المراجعة.",
                  "icon": '<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><rect x="2" y="14" width="4" height="6" rx="1.5"/><rect x="18" y="14" width="4" height="6" rx="1.5"/><path d="M20 20c0 1.5-2 2-5 2"/>'},
    "doctor": {"name": "الطبيب", "color": "#0F8A5F", "soft": "#E2F4EC",
               "desc": "يتابع جدول مواعيده، وينهي الكشف، ويحدد المراجعة بنفسه أو يطلبها من الاستقبال، ويحجز في جدوله.",
               "icon": '<path d="M6 3v6a5 5 0 0 0 10 0V3"/><path d="M11 14v3a4 4 0 0 0 8 0v-2"/><circle cx="19" cy="13" r="2"/>'},
    "admin": {"name": "المدير", "color": "#6D3FD1", "soft": "#EEE8FB",
              "desc": "يتابع أداء المركز، ويدير التخصصات والأطباء والإجازات والموظفين، ويضبط قواعد الحجز.",
              "icon": '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'},
}

SECTIONS = [
    ("patient", ["p-register", "p-book-1", "p-book-2", "p-book-3", "p-book-4", "p-book-5", "p-my", "p-reschedule"]),
    ("reception", ["r-dashboard", "r-schedule", "r-free-slot", "r-pending", "r-followups", "r-search", "r-collect", "r-quick-patient", "r-quick-pay", "r-bell"]),
    ("doctor", ["d-week", "d-sheet", "d-finish-book", "d-finish-request"]),
    ("admin", ["a-reports", "a-specialties", "a-doctors", "a-timeoff", "a-staff", "a-settings", "a-refunds"]),
]

# Extra lines shown under a screen (no callout)
NOTES = {
    "d-week": "الحجز من حساب الطبيب يتم بنفس خطوات المريض، لكن في جدول الطبيب فقط، ويمكن في اليوم نفسه.",
    "r-quick-pay": "الطبيب أيضًا يستطيع الحجز في جدوله، لكن التحصيل دائمًا من الاستقبال.",
    "p-book-5": "بعد الحجز يصلك تأكيد على الواتساب والبريد، وتذكير قبل الموعد بـ 24 ساعة.",
    "a-settings": "الأسعار شاملة الضريبة؛ اترك نسبة الضريبة 0 إذا لم يكن المركز مسجلًا في ضريبة القيمة المضافة.",
}


GUT = 40  # display px of margin on each side of a screenshot, where the numbers sit


def place_badges(s, scale):
    """Numbers go in the side margins, level with their target; the side nearest the target wins."""
    W, H = s["w"], s["h"]
    r = 12.5 / scale
    G = GUT / scale
    gap = 2.7 * r
    sides = {"left": [], "right": []}
    for m in s["marks"]:
        b = m["box"]
        side = "left" if b["x"] < W - (b["x"] + b["w"]) else "right"
        cy = b["y"] + b["h"] / 2
        sides[side].append([m, min(max(cy + m.get("dy", 0), r + 2 / scale), H - r - 2 / scale)])
    out = []
    for side, lst in sides.items():
        lst.sort(key=lambda t: t[1])
        for i in range(1, len(lst)):
            lst[i][1] = max(lst[i][1], lst[i - 1][1] + gap)
        # pushed past the bottom: slide the stack back up
        over = (lst[-1][1] + r) - H if lst else 0
        if over > 0:
            for t in lst:
                t[1] -= over
            for i in range(len(lst) - 2, -1, -1):
                lst[i][1] = min(lst[i][1], lst[i + 1][1] - gap)
        x = -G / 2 if side == "left" else W + G / 2
        out += [(m, (x, y), False) for m, y in lst]
    out.sort(key=lambda t: t[0]["n"])
    return out, r


def nearest_on_rect(px, py, b, pad):
    x0, y0, x1, y1 = b["x"] - pad, b["y"] - pad, b["x"] + b["w"] + pad, b["y"] + b["h"] + pad
    nx, ny = min(max(px, x0), x1), min(max(py, y0), y1)
    return nx, ny


def overlay(s, scale):
    W, H = s["w"], s["h"]
    G = GUT / scale
    sw = 2.4 / scale
    pad = 5 / scale
    items, r = place_badges(s, scale)
    parts = [f'<svg class="ov" viewBox="{-G:.1f} 0 {W + 2*G:.1f} {H:.1f}" preserveAspectRatio="none">',
             f'<defs><marker id="ah-{s["id"]}" viewBox="0 0 10 10" refX="8.2" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse">'
             f'<path d="M0 0L10 5L0 10z" fill="{ORANGE}"/></marker>'
             f'<filter id="sh-{s["id"]}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="{1.5/scale:.2f}" stdDeviation="{2/scale:.2f}" flood-color="#000" flood-opacity=".28"/></filter></defs>']
    for m, _, _ in items:
        b = m["box"]
        parts.append(f'<rect x="{b["x"]-pad:.1f}" y="{b["y"]-pad:.1f}" width="{b["w"]+2*pad:.1f}" height="{b["h"]+2*pad:.1f}" rx="{8/scale:.1f}" '
                     f'fill="{ORANGE}" fill-opacity=".07" stroke="{ORANGE}" stroke-width="{sw:.2f}"/>')
    for m, (px, py), _ in items:
        b = m["box"]
        ex, ey = nearest_on_rect(px, py, b, pad + 2 / scale)
        dx, dy = ex - px, ey - py
        L = math.hypot(dx, dy) or 1
        sx, sy = px + dx / L * (r + 1 / scale), py + dy / L * (r + 1 / scale)
        ex2, ey2 = ex - dx / L * (2 / scale), ey - dy / L * (2 / scale)
        # leave the margin horizontally, then bend toward the target
        c1x = sx + (G * 0.9 if px < 0 else -G * 0.9)
        d = f"M{sx:.1f} {sy:.1f} C{c1x:.1f} {sy:.1f} {c1x:.1f} {ey2:.1f} {ex2:.1f} {ey2:.1f}"
        # white halo underneath so the line never reads as a strike-through on the screenshot's text
        parts.append(f'<path d="{d}" fill="none" stroke="#fff" stroke-opacity=".95" stroke-width="{sw * 2.6:.2f}" stroke-linecap="round"/>')
        parts.append(f'<path d="{d}" fill="none" stroke="{ORANGE}" stroke-width="{sw:.2f}" stroke-linecap="round" marker-end="url(#ah-{s["id"]})"/>')
    for m, (px, py), _ in items:
        parts.append(f'<g filter="url(#sh-{s["id"]})"><circle cx="{px:.1f}" cy="{py:.1f}" r="{r:.1f}" fill="{ORANGE}" stroke="#fff" stroke-width="{2.2/scale:.2f}"/></g>'
                     f'<text x="{px:.1f}" y="{py + 0.5/scale:.1f}" font-size="{14/scale:.1f}" font-weight="800" fill="#fff" text-anchor="middle" dominant-baseline="central">{ar(m["n"])}</text>')
    parts.append("</svg>")
    return "".join(parts)


def shot_html(s, max_w, max_h):
    scale = min((max_w - 2 * GUT) / s["w"], max_h / s["h"])
    dw, dh = s["w"] * scale, s["h"] * scale
    return (f'<div class="shotwrap" style="width:{dw + 2*GUT:.0f}px;height:{dh:.0f}px">'
            f'<div class="shot" style="width:{dw:.0f}px;height:{dh:.0f}px"><img src="img/{s["id"]}.jpg" alt=""></div>{overlay(s, scale)}</div>')


def steps_html(s, cols):
    lis = "".join(f'<li><span class="num">{ar(m["n"])}</span><span>{esc(m["text"])}</span></li>' for m in s["marks"])
    return f'<ol class="steps cols{cols}">{lis}</ol>'


pages = []  # (kind, html, has_footer, title_for_toc)


def page(body, cls="", footer=True, accent=None):
    pages.append({"body": body, "cls": cls, "footer": footer, "accent": accent})
    return len(pages)


def screen_page(sid, role, idx, total):
    s = screens[sid]
    R = ROLES[role]
    narrow = s["w"] < 700
    head = (f'<div class="sh-head"><span class="role-tag" style="background:{R["soft"]};color:{R["color"]}">{R["name"]} · {ar(idx)}/{ar(total)}</span>'
            f'<h2>{esc(s["title"])}</h2><p class="intro">{esc(s["intro"])}</p></div>')
    note = f'<p class="note"><b>ملاحظة:</b> {esc(NOTES[sid])}</p>' if sid in NOTES else ""
    if narrow:
        body = (head + f'<div class="split"><div class="split-img">{shot_html(s, 330 + 2 * GUT, 760)}</div>'
                f'<div class="split-steps">{steps_html(s, 1)}{note}</div></div>')
    else:
        body = head + f'<div class="center">{shot_html(s, CONTENT_W + 2 * GUT, 600)}</div>' + steps_html(s, 2 if len(s["marks"]) > 2 else 1) + note
    return page(body, accent=R["color"])


# ---------------------------------------------------------------- cover
LOGO = ('<svg viewBox="0 0 48 48" class="logo"><rect width="48" height="48" rx="13" fill="#fff"/>'
        '<path d="M20 11h8v9h9v8h-9v9h-8v-9h-9v-8h9z" fill="#0E7490"/><circle cx="38" cy="10" r="3.2" fill="#34D399"/></svg>')
chips = "".join(f'<span class="cv-chip"><svg viewBox="0 0 24 24">{R["icon"]}</svg>{R["name"]}</span>' for R in ROLES.values())
page(f'''<div class="cover">
  <div class="cv-grid"></div>
  <div class="cv-top">{LOGO}<div><b>شفاء</b><span>مركز شفاء الطبي</span></div></div>
  <div class="cv-main">
    <p class="cv-kicker">دليل المستخدم</p>
    <h1>نظام حجز المواعيد</h1>
    <p class="cv-sub">شرح مصوَّر خطوة بخطوة لكل مستخدمي النظام: المريض، وموظف الاستقبال، والطبيب، والمدير.</p>
    <div class="cv-chips">{chips}</div>
  </div>
  <div class="cv-foot"><span>الإصدار ١٫٠</span><span>أكتوبر ٢٠٢٦</span></div>
</div>''', cls="p-cover", footer=False)

toc_index = page("", footer=True)  # filled after pagination

# ---------------------------------------------------------------- before you start
STATUS = [("مؤكد", "#0E7490", "#E3F2F6", "الموعد ثابت، والمريض ينتظره."),
          ("بانتظار التأكيد", "#9A6700", "#FBF0D4", "حجز «الدفع في العيادة» ينتظر تأكيد الاستقبال."),
          ("بانتظار الدفع", "#4B5563", "#E9EDF2", "دفع إلكتروني لم يكتمل؛ الموعد محجوز 15 دقيقة."),
          ("مكتمل", "#0F8A5F", "#E2F4EC", "انتهى الكشف."),
          ("لم يحضر", "#6B7280", "#F1F2F4", "سُجّل غياب المريض."),
          ("ملغى", "#C2352B", "#FBE7E5", "أُلغي الموعد وعاد متاحًا للحجز.")]
rows = "".join(f'<tr><td><b>{R["name"]}</b></td><td>{esc(R["desc"])}</td></tr>' for R in ROLES.values())
legend = "".join(f'<div class="st"><span class="badge" style="color:{c};background:{bg}">{n}</span><span>{d}</span></div>' for n, c, bg, d in STATUS)
page(f'''<div class="sh-head"><span class="role-tag" style="background:#E3F2F6;color:#0E7490">البداية</span><h2>قبل أن تبدأ</h2>
<p class="intro">النظام واحد للجميع، وكل مستخدم يرى الشاشات الخاصة بدوره فقط بعد تسجيل الدخول.</p></div>
<table class="tbl"><thead><tr><th style="width:26%">المستخدم</th><th>ماذا يفعل في النظام</th></tr></thead><tbody>{rows}</tbody></table>
<h3>كيف تقرأ هذا الدليل</h3>
<div class="howto"><span class="num">١</span><p>كل صورة عليها <b style="color:{ORANGE}">أرقام برتقالية وأسهم</b> تشير إلى الزر أو الحقل المقصود، وتحت الصورة شرح كل رقم بالترتيب.</p></div>
<h3>حالات الموعد</h3>
<div class="legend">{legend}</div>
<h3>أدوات في كل الشاشات</h3>
<ul class="plain"><li><b>اللغة:</b> زر «English» أعلى الشاشة يبدّل بين العربية والإنجليزية.</li>
<li><b>الوضع الليلي:</b> زر القمر بجانبه.</li>
<li><b>القائمة الجانبية:</b> تُطوى من الزر أسفلها أو بالاختصار Ctrl + B، وعلى الجوال تُفتح من زر القائمة.</li></ul>''', accent="#0E7490")
screen_page("p-login", "patient", 1, 1)
pages[-1]["body"] = pages[-1]["body"].replace("المريض · ١/١", "الجميع")

# ---------------------------------------------------------------- sections
section_pages = {}
for si, (role, ids) in enumerate(SECTIONS, 1):
    R = ROLES[role]
    lst = "".join(f'<li data-sid="{sid}"><span>{esc(screens[sid]["title"])}</span><i></i><b class="pg">__P_{sid}__</b></li>' for sid in ids)
    section_pages[role] = page(f'''<div class="divider" style="--c:{R["color"]};--s:{R["soft"]}">
  <div class="dv-band"><div class="dv-grid"></div><span class="dv-no">القسم {ar(si)}</span>
    <div class="dv-icon"><svg viewBox="0 0 24 24">{R["icon"]}</svg></div><h1>{R["name"]}</h1><p>{esc(R["desc"])}</p></div>
  <div class="dv-body"><h3>في هذا القسم</h3><ol class="dv-list">{lst}</ol></div></div>''', cls="p-divider", accent=R["color"])
    for i, sid in enumerate(ids, 1):
        n = screen_page(sid, role, i, len(ids))
        screens[sid]["page"] = n

# ---------------------------------------------------------------- rules
RULES = [("أقرب موعد يمكن حجزه", "بعد 24 ساعة", "اليوم نفسه", "اليوم نفسه، في جدوله فقط"),
         ("أبعد موعد", "30 يومًا", "بلا حد", "بلا حد"),
         ("كشف واحد للمريض في اليوم", "نعم", "نعم", "نعم"),
         ("حالة الحجز بعد إنشائه", "إلكتروني: مؤكد بعد الدفع — في العيادة: بانتظار التأكيد", "مؤكد", "مؤكد"),
         ("مهلة الدفع الإلكتروني", "15 دقيقة", "—", "—"),
         ("إلغاء تلقائي لغير المؤكد", "بعد 12 ساعة، أو قبل الموعد بـ 6 ساعات (أيهما أسبق)", "—", "—"),
         ("حجوزات بانتظار التأكيد", "5 كحد أقصى لكل حساب", "—", "—"),
         ("التغيير والإلغاء", "حتى 3 ساعات قبل الموعد", "في أي وقت (الإلغاء بسبب)", "—"),
         ("استرداد المدفوع إلكترونيًا", "كامل", "كامل", "—"),
         ("التذكير", "واتساب وبريد قبل الموعد بـ 24 ساعة", "—", "—")]
rr = "".join(f"<tr><td><b>{a}</b></td><td>{b}</td><td>{c}</td><td>{d}</td></tr>" for a, b, c, d in RULES)
rules_page = page(f'''<div class="sh-head"><span class="role-tag" style="background:#E3F2F6;color:#0E7490">مرجع سريع</span><h2>القواعد المهمة</h2>
<p class="intro">الإعدادات الحالية للمركز؛ يستطيع المدير تغيير أغلبها من شاشة الإعدادات.</p></div>
<table class="tbl rules"><thead><tr><th style="width:24%">القاعدة</th><th>المريض</th><th>الاستقبال والمدير</th><th>الطبيب</th></tr></thead><tbody>{rr}</tbody></table>
<ul class="plain"><li>المركز مغلق يوم الجمعة، ومدة الموعد 30 دقيقة.</li>
<li>الأسعار بالريال السعودي وتشمل الضريبة عند تفعيلها. لكل طبيب سعر كشف وسعر مراجعة (قد تكون المراجعة مجانية).</li>
<li>التواريخ تظهر بالتقويمين الميلادي والهجري (أم القرى).</li>
<li>الصور في هذا الدليل من بيانات تجريبية؛ الأسماء والأرقام غير حقيقية.</li></ul>''', accent="#0E7490")

# ---------------------------------------------------------------- toc
toc_rows = f'<li class="toc-gen"><span>قبل أن تبدأ · تسجيل الدخول</span><i></i><b>{ar(3)}</b></li>'
for si, (role, ids) in enumerate(SECTIONS, 1):
    R = ROLES[role]
    toc_rows += (f'<li class="toc-sec" style="--c:{R["color"]};--s:{R["soft"]}"><span class="toc-ic"><svg viewBox="0 0 24 24">{R["icon"]}</svg></span>'
                 f'<span><small>القسم {ar(si)}</small>{R["name"]}</span><i></i><b>{ar(section_pages[role])}</b></li>')
    toc_rows += '<li class="toc-items"><ol>' + "".join(f'<li class="toc-item"><span>{esc(screens[sid]["title"])}</span><i></i><b>{ar(screens[sid]["page"])}</b></li>' for sid in ids) + "</ol></li>"
toc_rows += f'<li class="toc-gen"><span>القواعد المهمة</span><i></i><b>{ar(rules_page)}</b></li>'
pages[toc_index - 1]["body"] = f'<div class="sh-head"><h2 class="toc-title">المحتويات</h2></div><ol class="toc">{toc_rows}</ol>'
pages[toc_index - 1]["accent"] = "#0E7490"

# fill page numbers in divider lists
for p in pages:
    for sid, s in screens.items():
        p["body"] = p["body"].replace(f"__P_{sid}__", ar(s.get("page", "")))

TOTAL = len(pages)
out = []
for i, p in enumerate(pages, 1):
    foot = (f'<div class="foot"><span>دليل استخدام نظام حجز المواعيد — مركز شفاء الطبي</span><span class="pn">{ar(i)} / {ar(TOTAL)}</span></div>'
            if p["footer"] else "")
    bar = f'<div class="topbar" style="background:{p["accent"]}"></div>' if p["accent"] and p["footer"] else ""
    out.append(f'<section class="page {p["cls"]}">{bar}<div class="inner">{p["body"]}</div>{foot}</section>')

CSS = open(os.path.join(HERE, "guide.css"), encoding="utf8").read().replace("__FONT__", "file:///" + FONT).replace("__FONT_LATIN__", "file:///" + FONT_LATIN).replace("__ORANGE__", ORANGE)
doc = f'<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>دليل استخدام نظام حجز المواعيد</title><style>{CSS}</style></head><body>{"".join(out)}</body></html>'
open(os.path.join(HERE, "guide.html"), "w", encoding="utf8").write(doc)
print("pages", TOTAL)
