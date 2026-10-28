// Captures the user-guide screens and, for each numbered step, the on-screen box of the element it points at.
// Output: ../guide/img/<id>.jpg + ../guide/screens.json. Read-only: dialogs are opened, never submitted.
import { chromium } from "playwright-core"
import fs from "node:fs"

const BASE = "http://localhost:5173"
const root = new URL("../guide/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")
fs.mkdirSync(root + "img", { recursive: true })
const W = 1280
const H = 960
const screens = []
const browser = await chromium.launch({ channel: "msedge", headless: true })

async function session(email) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, locale: "ar-SA", colorScheme: "light" })
  await ctx.addInitScript(() => {
    localStorage.setItem("clinic-theme", "light")
    localStorage.setItem("clinic-locale", "ar")
    localStorage.removeItem("clinic-sidebar")
  })
  const page = await ctx.newPage()
  if (email) {
    await page.goto(BASE + "/login")
    await page.waitForSelector("#email")
    await page.waitForTimeout(1800)
    await page.fill("#email", email)
    await page.fill("#password", "password")
    await page.click('button[type="submit"]')
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 })
    await page.waitForTimeout(1500)
  }
  return { ctx, page }
}

async function go(page, path) {
  await page.goto(BASE + path)
  await page.waitForLoadState("networkidle").catch(() => {})
  await page.waitForTimeout(2200)
}

/**
 * marks: [{ loc, text, dx?, dy? }]  — loc is a Playwright locator; dx/dy nudge the badge.
 * opts.clip: locator to crop to (with padding); opts.pad
 */
async function capture(page, id, role, title, intro, marks, opts = {}) {
  try {
    await page.waitForTimeout(opts.wait ?? 900)
    let clip = { x: 0, y: 0, width: W, height: H }
    if (opts.clip) {
      const b = await opts.clip.boundingBox()
      const pad = opts.pad ?? 24
      const x = Math.max(0, b.x - pad)
      const y = Math.max(0, b.y - pad)
      clip = { x, y, width: Math.min(W - x, b.width + pad * 2), height: Math.min(H - y, b.height + pad * 2) }
    }
    const out = []
    for (const [i, m] of marks.entries()) {
      const b = await m.loc.first().boundingBox().catch(() => null)
      if (!b) {
        console.log("  missing mark", id, i + 1, m.text.slice(0, 30))
        continue
      }
      const box = { x: b.x - clip.x, y: b.y - clip.y, w: b.width, h: b.height }
      // the target must sit inside the picture, or the arrow points at nothing
      if (box.x < -2 || box.y < -2 || box.x + box.w > clip.width + 2 || box.y + box.h > clip.height + 2) {
        throw new Error(`mark ${i + 1} is outside the screenshot (${m.text.slice(0, 30)}…)`)
      }
      out.push({ n: out.length + 1, text: m.text, dx: m.dx ?? 0, dy: m.dy ?? 0, box })
    }
    await page.screenshot({ path: `${root}img/${id}.jpg`, type: "jpeg", quality: 86, clip })
    screens.push({ id, role, title, intro, w: clip.width, h: clip.height, marks: out })
    console.log("ok", id, out.length + "/" + marks.length)
  } catch (e) {
    console.log("FAIL", id, e.message.split("\n")[0])
  }
}

async function step(name, fn) {
  try {
    await fn()
  } catch (e) {
    console.log("FAIL", name, e.message.split("\n")[0])
  }
}

const btn = (page, name, exact = false) => page.getByRole("button", { name, exact })
const slotSection = (scope) => scope.locator('section[aria-label="اختر الوقت"] button:not([disabled])')

/* ================================================================ patient */
{
  const { ctx, page } = await session()
  await go(page, "/register")
  await capture(page, "p-register", "patient", "إنشاء حساب جديد", "أول مرة تستخدم النظام؟ أنشئ حسابك في دقيقة واحدة.", [
    { loc: page.locator("#name"), text: "اكتب اسمك الكامل." },
    { loc: page.locator("#phone"), text: "رقم الجوال بصيغة 05XXXXXXXX، وعليه تصلك رسائل واتساب." },
    { loc: page.locator("#reg-gender").locator("xpath=.."), text: "اختر الجنس." },
    { loc: page.locator('button[type="submit"]'), text: "اضغط «إنشاء الحساب»، ثم افتح بريدك واضغط رابط التفعيل. لا يمكن الحجز قبل تفعيل البريد." },
  ])
  await go(page, "/login")
  await capture(page, "p-login", "patient", "تسجيل الدخول", "نفس الشاشة لكل المستخدمين: المريض والموظف والطبيب والمدير.", [
    { loc: page.locator("#email"), text: "البريد الإلكتروني." },
    { loc: page.locator("#password"), text: "كلمة المرور." },
    { loc: page.locator('button[type="submit"]'), text: "اضغط «تسجيل الدخول»؛ يفتح لك النظام شاشتك حسب دورك." },
    { loc: page.getByText("نسيت كلمة المرور؟"), text: "نسيت كلمة المرور؟ يصلك رابط لتغييرها على بريدك." },
  ])
  await ctx.close()
}
{
  const { ctx, page } = await session("patient@demo.test")
  await go(page, "/new")
  await capture(page, "p-book-1", "patient", "الحجز — الخطوة 1: التخصص", "اضغط «احجز موعدًا» من القائمة، ثم اتبع الخطوات الخمس الظاهرة أعلى الشاشة.", [
    { loc: page.locator("ol").first(), text: "شريط الخطوات: يوضح أين أنت، ويمكنك الرجوع لأي خطوة سابقة بالضغط عليها." },
    { loc: page.locator("main section button[aria-pressed]"), text: "اختر التخصص المطلوب." },
    { loc: page.locator("aside").last(), text: "ملخص الحجز: يتحدث مع كل اختيار، ويعرض السعر في النهاية." },
  ])
  await step("book flow", async () => {
    await page.locator("main section button[aria-pressed]").first().click()
    await page.waitForTimeout(1500)
    await capture(page, "p-book-2", "patient", "الخطوة 2: الطبيب", "تظهر أطباء التخصص مع خبرتهم وتقييمهم ومواعيد عملهم.", [
      { loc: page.locator("main section button[aria-pressed]").first(), text: "اختر الطبيب." },
      { loc: page.locator("main section button[aria-pressed]").first().locator("div.border-t"), text: "سعر الكشف وسعر المراجعة لهذا الطبيب." },
    ])
    await page.locator("main section button[aria-pressed]").first().click()
    await page.waitForTimeout(2800)
    await slotSection(page).first().click()
    await btn(page, "التالي", true).last().evaluate((el) => el.scrollIntoView({ block: "end" }))
    await page.evaluate(() => window.scrollBy(0, 24))
    await page.waitForTimeout(400)
    await capture(page, "p-book-3", "patient", "الخطوة 3: اليوم والوقت", "التقويم يعرض الشهر كاملًا بالتاريخين الميلادي والهجري.", [
      { loc: page.locator('main button[aria-pressed="true"]').first(), text: "اختر اليوم. النقطة الخضراء = فيه مواعيد متاحة، والرقم المشطوب = يوم مكتمل." },
      { loc: slotSection(page).first(), text: "اختر الوقت. الأوقات المشطوبة محجوزة. المواعيد مقسمة صباحًا ومساءً." },
      { loc: btn(page, "التالي", true).last(), text: "اضغط «التالي»." },
    ])
    await btn(page, "التالي", true).last().click()
    await page.waitForTimeout(1500)
    await page.getByText("إضافة شخص جديد").evaluate((el) => el.scrollIntoView({ block: "center" }))
    await page.waitForTimeout(500)
    await capture(page, "p-book-4", "patient", "الخطوة 4: المريض", "يمكنك الحجز لنفسك أو لأي فرد من أسرتك من نفس الحساب.", [
      { loc: page.locator("main section button[aria-pressed]:not([disabled])"), text: "اختر الشخص الذي سيحضر الكشف." },
      { loc: page.getByText("إضافة شخص جديد"), text: "أضف فردًا جديدًا من الأسرة (الاسم، الجوال، تاريخ الميلاد، الجنس)." },
    ])
    await page.locator("main section button[aria-pressed]:not([disabled])").first().click()
    await btn(page, "التالي", true).last().click()
    await page.waitForTimeout(1500)
    await capture(page, "p-book-5", "patient", "الخطوة 5: الدفع والتأكيد", "راجع بياناتك في الملخص ثم اختر طريقة الدفع.", [
      { loc: page.locator('button:has-text("الدفع الإلكتروني")'), text: "الدفع الإلكتروني (مدى، Apple Pay، البطاقات): يُحجز الموعد لك 15 دقيقة حتى تدفع، ثم يتأكد فورًا." },
      { loc: page.locator('button:has-text("الدفع في العيادة")'), text: "الدفع في العيادة: يبقى الحجز «بانتظار التأكيد» حتى يؤكده الاستقبال." },
      { loc: page.locator("#notes"), text: "ملاحظات للطبيب (اختياري)." },
      { loc: btn(page, /ادفع|تأكيد الحجز/).last(), text: "اضغط زر التأكيد لإتمام الحجز." },
    ])
  })
  await go(page, "/my")
  await capture(page, "p-my", "patient", "مواعيدي", "كل مواعيدك ومواعيد أسرتك في مكان واحد.", [
    { loc: page.getByRole("link", { name: "احجز المراجعة" }), text: "إذا طلب الطبيب مراجعة تظهر هنا بتاريخها؛ اضغط «احجز المراجعة» واختر الوقت فقط." },
    { loc: page.getByRole("tab").first(), text: "المواعيد القادمة والسابقة." },
    { loc: btn(page, "تغيير الموعد"), text: "تغيير الموعد: متاح حتى 3 ساعات قبل الموعد." },
    { loc: btn(page, "إلغاء", true), text: "الإلغاء: المدفوع إلكترونيًا يُسترد كاملًا." },
  ])
  await step("reschedule", async () => {
    await btn(page, "تغيير الموعد").first().click()
    await page.waitForTimeout(2200)
    const dlg = page.getByRole("dialog")
    await slotSection(dlg).first().click()
    await page.waitForTimeout(500)
    await capture(page, "p-reschedule", "patient", "تغيير الموعد", "نافذة واحدة: اختر اليوم والوقت الجديدين ثم أكّد.", [
      { loc: dlg.locator('button[aria-pressed="true"]').first(), text: "اختر اليوم الجديد." },
      { loc: slotSection(dlg).first(), text: "اختر الوقت الجديد." },
      { loc: btn(page, "تأكيد التغيير"), text: "اضغط «تأكيد التغيير»، ويصلك إشعار بالموعد الجديد." },
    ])
  })
  await ctx.close()
}

/* ================================================================ reception */
{
  const { ctx, page } = await session("staff@demo.test")
  await go(page, "/staff")
  await capture(page, "r-dashboard", "reception", "لوحة الاستقبال", "أول شاشة تظهر للموظف: صورة كاملة عن يوم العيادة.", [
    { loc: page.getByPlaceholder("ابحث عن مريض بالاسم أو رقم الهوية أو الجوال"), text: "البحث عن مريض بالاسم أو الجوال أو رقم الهوية." },
    { loc: page.locator("main").getByRole("link", { name: "حجز سريع" }), text: "«حجز سريع»: حجز لمريض في العيادة أو على الهاتف، حتى في اليوم نفسه." },
    { loc: page.getByText("بانتظار التأكيد").first(), text: "أرقام اليوم: الحجوزات، وما ينتظر التأكيد، والكشوفات المنتهية، والمواعيد الشاغرة." },
    { loc: btn(page, /التنبيهات/), text: "جرس التنبيهات: الرقم الأحمر = تنبيهات جديدة." },
  ])
  await step("schedule", async () => {
    const sec = page.locator('section[aria-labelledby="schedule-title"]')
    await sec.scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -90))
    await capture(page, "r-schedule", "reception", "جدول اليوم", "جدول كل طبيب لليوم، موعدًا موعدًا.", [
      { loc: page.getByLabel("ابحث باسم الطبيب أو التخصص"), text: "ابحث عن الطبيب بالاسم أو التخصص." },
      { loc: sec.locator('[role="tablist"] button').first(), text: "اختر الطبيب؛ الرقم بجانبه عدد حجوزاته اليوم." },
      { loc: sec.getByRole("button", { name: /تحصيل/ }).first(), text: "«تحصيل»: لمن لم يدفع بعد؛ يسجّل الدفع عند وصول المريض." },
      { loc: sec.getByText("مؤكد").first(), text: "حالة الموعد: مؤكد، بانتظار التأكيد، تم الكشف، لم يحضر." },
    ])
  })
  await step("free slot", async () => {
    const sec = page.locator('section[aria-labelledby="schedule-title"]')
    // a doctor who still has free slots later today
    const tabs = sec.locator('[role="tablist"] button')
    for (let i = 0; i < (await tabs.count()); i++) {
      if (await sec.locator('a[aria-label^="حجز موعد"]').count()) break
      await tabs.nth(i).click()
      await page.waitForTimeout(700)
    }
    const link = sec.locator('a[aria-label^="حجز موعد"]').first()
    await link.evaluate((el) => el.scrollIntoView({ block: "center" }))
    await page.waitForTimeout(600)
    await capture(page, "r-free-slot", "reception", "الحجز من موعد شاغر", "أسرع طريقة للحجز على الهاتف: من الجدول مباشرة.", [
      { loc: link, text: "اضغط «+ حجز» بجانب أي موعد شاغر قادم؛ يفتح الحجز السريع والطبيب واليوم والوقت محددة، فلا يبقى إلا اختيار المريض." },
    ])
    await page.evaluate(() => window.scrollTo(0, 0))
  })
  await step("pending", async () => {
    const sec = page.locator('section[aria-labelledby="pending-title"]')
    await sec.scrollIntoViewIfNeeded()
    await capture(page, "r-pending", "reception", "تأكيد الحجوزات", "حجوزات «الدفع في العيادة» تنتظر تأكيدك، الأقرب للإلغاء التلقائي أولًا.", [
      { loc: sec.getByText(/يُلغى/).first(), text: "متى يُلغى الحجز تلقائيًا إن لم يُؤكَّد." },
      { loc: sec.locator('a[href^="tel:"]').first(), text: "اتصل بالمريض للتأكد من حضوره." },
      { loc: sec.getByRole("button", { name: "تأكيد" }).first(), text: "اضغط «تأكيد»، ويصل للمريض إشعار بالتأكيد." },
    ], { clip: sec, pad: 16 })
  })
  await step("follow-ups", async () => {
    const sec = page.locator('section[aria-labelledby="follow-ups-title"]')
    await sec.scrollIntoViewIfNeeded()
    await capture(page, "r-followups", "reception", "طلبات المراجعة", "عندما يطلب الطبيب مراجعة دون أن يحجزها، تصل هنا لتحجزها مع المريض.", [
      { loc: sec.locator("span.rounded-lg").first(), text: "الموعد المطلوب: أصفر = قريب، أحمر = متأخر." },
      { loc: sec.getByRole("link", { name: /حجز/ }).first(), text: "«حجز»: يفتح الحجز على اختيار الوقت مباشرة، ويختفي الطلب بعد الحجز." },
      { loc: sec.getByRole("button", { name: "إغلاق الطلب" }).first(), text: "أغلق الطلب إذا اعتذر المريض عن المراجعة." },
    ], { clip: sec, pad: 16 })
  })
  await step("search", async () => {
    await page.evaluate(() => window.scrollTo(0, 0))
    const box = page.getByPlaceholder("ابحث عن مريض بالاسم أو رقم الهوية أو الجوال")
    await box.fill("نورة العتيبي")
    await page.waitForTimeout(2000)
    await page.locator("main").getByRole("button").filter({ hasText: "نورة العتيبي" }).first().click()
    await page.waitForTimeout(1600)
    await capture(page, "r-search", "reception", "البحث عن مريض", "اكتب 3 أحرف أو أرقام على الأقل، ثم اضغط على المريض لعرض ملفه.", [
      { loc: box, text: "اكتب الاسم أو الجوال أو جزءًا من رقم الهوية." },
      { loc: page.locator("main").getByRole("button").filter({ hasText: "نورة العتيبي" }).first(), text: "بيانات المريض: العمر والجوال ورقم الهوية." },
      { loc: page.getByText("الزيارات السابقة").first(), text: "مواعيده القادمة وزياراته السابقة مع حالة الدفع." },
      { loc: page.getByRole("link", { name: "حجز جديد" }), text: "«حجز جديد» لهذا المريض مباشرة." },
    ])
    await box.fill("")
  })
  await step("collect", async () => {
    await go(page, "/staff")
    await page.getByRole("button", { name: /تحصيل/ }).first().click()
    await page.waitForTimeout(1000)
    const dlg = page.getByRole("dialog")
    await dlg.getByText("تحويل بنكي").first().click()
    await page.waitForTimeout(500)
    await capture(page, "r-collect", "reception", "تحصيل المبلغ", "تظهر عند الضغط على «تحصيل».", [
      { loc: dlg.getByText("نقدًا").first().locator("xpath=ancestor::*[contains(@class,'grid')][1]"), text: "اختر طريقة الدفع: نقدًا، أو شبكة (مدى/بطاقة/Apple Pay)، أو تحويل بنكي." },
      { loc: dlg.locator("input").last(), text: "رقم المرجع: إلزامي للتحويل البنكي (رقم الحوالة)، واختياري للشبكة (رقم الإيصال)." },
      { loc: dlg.getByRole("button").filter({ hasText: /تحصيل|تأكيد|تسجيل/ }).last(), text: "اضغط زر التسجيل؛ يُحفظ المبلغ باسمك ووقت التحصيل." },
    ], { clip: dlg, pad: 20 })
    await page.keyboard.press("Escape")
  })
  await step("bell", async () => {
    await btn(page, /التنبيهات/).click()
    await page.waitForTimeout(1000)
    const pop = page.locator('[data-slot="popover-content"]')
    await capture(page, "r-bell", "reception", "التنبيهات", "يتحدث الجرس تلقائيًا كل 30 ثانية.", [
      { loc: pop.locator("button").nth(1), text: "كل تنبيه: ماذا حدث، للمريض أي طبيب، ومتى. اضغطه لفتح الشاشة المعنية." },
      { loc: pop.getByRole("button", { name: "تعليم الكل كمقروء" }), text: "«تعليم الكل كمقروء» يصفّر العداد." },
    ], { clip: pop, pad: 16 })
    await page.keyboard.press("Escape")
  })
  await step("quick book", async () => {
    await go(page, "/new")
    await page.locator("main section button[aria-pressed]").first().click()
    await page.waitForTimeout(1300)
    await page.locator("main section button[aria-pressed]").first().click()
    await page.waitForTimeout(2800)
    await slotSection(page).first().click()
    await btn(page, "التالي", true).last().click()
    await page.waitForTimeout(1200)
    const search = page.getByPlaceholder("ابحث برقم الجوال أو الهوية أو الاسم")
    await search.fill("نورة")
    await page.waitForTimeout(2000)
    await capture(page, "r-quick-patient", "reception", "الحجز السريع — اختيار المريض", "الخطوات نفسها التي يتبعها المريض، مع البحث في كل المرضى.", [
      { loc: search, text: "ابحث عن المريض بالجوال أو الهوية أو الاسم." },
      { loc: page.locator("main section button[aria-pressed]:not([disabled])"), text: "اختر المريض من النتائج." },
      { loc: page.getByText("إضافة شخص جديد"), text: "مريض جديد؟ أضفه هنا ويُحجز له مباشرة." },
    ])
    await page.locator("main section button[aria-pressed]:not([disabled])").first().click()
    await btn(page, "التالي", true).last().click()
    await page.waitForTimeout(1300)
    await capture(page, "r-quick-pay", "reception", "الحجز السريع — الدفع", "حجز الموظف يتأكد فورًا؛ يبقى تحديد الدفع.", [
      { loc: page.locator('button:has-text("يدفع الآن")'), text: "«يدفع الآن»: المريض أمامك ويدفع حالًا." },
      { loc: page.locator('button:has-text("يدفع عند الحضور")'), text: "«يدفع عند الحضور»: يُحصَّل لاحقًا من زر «تحصيل»." },
      { loc: page.locator('button:has-text("شبكة")').first().locator("xpath=ancestor::*[contains(@class,'grid')][1]"), text: "طريقة الدفع: نقدًا، أو شبكة، أو تحويل بنكي (برقم الحوالة)." },
      { loc: btn(page, "تأكيد الحجز"), text: "اضغط «تأكيد الحجز»." },
    ])
  })
  await ctx.close()
}

/* ================================================================ doctor */
{
  const { ctx, page } = await session("doctor@demo.test")
  await go(page, "/doctor")
  await capture(page, "d-week", "doctor", "جدول مواعيدي", "الطبيب يرى جدوله فقط، بالألوان حسب حالة كل موعد.", [
    { loc: page.getByText("أسبوع", { exact: true }).first(), text: "اختر طريقة العرض: يوم، أو أسبوع، أو شهر." },
    { loc: btn(page, "اليوم", true), text: "«اليوم» يرجعك لتاريخ اليوم، والأسهم للتنقل." },
    { loc: page.locator("main").getByRole("button").filter({ hasText: /\S/ }).nth(8), text: "كل مربع موعد: اسم المريض ولون حالته؛ أيقونة السهمين = مراجعة." },
    { loc: page.locator("aside").getByRole("link", { name: "احجز موعدًا" }), text: "«احجز موعدًا»: الطبيب يحجز في جدوله فقط، ويتأكد الحجز فورًا." },
  ])
  await step("day + sheet", async () => {
    await page.getByText("يوم", { exact: true }).first().click()
    await page.waitForTimeout(1500)
    await page.locator("ol button", { hasText: "مؤكد" }).first().click()
    await page.waitForTimeout(1500)
    const sheet = page.locator('[data-slot="sheet-content"]')
    await capture(page, "d-sheet", "doctor", "تفاصيل الموعد", "اضغط على أي موعد في الجدول لتظهر تفاصيله.", [
      { loc: sheet.locator("div.rounded-2xl").first(), text: "بيانات المريض: الاسم والجنس والعمر." },
      { loc: sheet.locator('a[href^="tel:"]'), text: "رقم الجوال للتواصل." },
      { loc: btn(page, "إنهاء الكشف"), text: "«إنهاء الكشف»: يظهر في يوم الموعد أو بعده." },
      { loc: btn(page, "لم يحضر"), text: "«لم يحضر»: يظهر بعد بدء الموعد فقط." },
    ], { clip: sheet, pad: 0 })
    await btn(page, "إنهاء الكشف").first().click()
    await page.waitForTimeout(1000)
    await page.getByRole("switch").first().click()
    await page.waitForTimeout(2800)
    const dlg = page.getByRole("dialog").last()
    await slotSection(dlg).first().click()
    await page.waitForTimeout(500)
    await capture(page, "d-finish-book", "doctor", "إنهاء الكشف — حجز المراجعة الآن", "إذا احتاج المريض مراجعة يمكنك حجزها بنفسك فورًا.", [
      { loc: page.getByRole("switch").first(), text: "فعّل «هل يحتاج المريض إلى مراجعة؟»." },
      { loc: page.getByRole("radio", { name: "احجز الميعاد الآن" }), text: "اختر «احجز الميعاد الآن»." },
      { loc: slotSection(dlg).first(), text: "اختر اليوم والوقت من جدولك." },
      { loc: btn(page, "إنهاء وإرسال إشعار"), text: "اضغط «إنهاء وإرسال إشعار»: ينتهي الكشف ويتأكد موعد المراجعة ويصل المريض إشعار." },
    ], { clip: dlg, pad: 12 })
    await page.getByRole("radio", { name: "اطلب من الاستقبال" }).click()
    await page.waitForTimeout(1200)
    await capture(page, "d-finish-request", "doctor", "إنهاء الكشف — طلب المراجعة من الاستقبال", "أو اترك الحجز للاستقبال والمريض بتحديد المدة فقط.", [
      { loc: page.getByRole("radio", { name: "اطلب من الاستقبال" }), text: "اختر «اطلب من الاستقبال»." },
      { loc: page.getByRole("button", { name: "أسبوعين", exact: true }), text: "حدد المدة (أسبوع، أسبوعين، شهر، 3 أشهر)…" },
      { loc: page.locator('input[type="date"]'), text: "…أو اختر تاريخًا آخر بنفسك." },
      { loc: page.locator("#follow-up-note"), text: "ملاحظة للاستقبال (اختياري)، مثل: بعد نتيجة التحليل." },
      { loc: btn(page, "إنهاء وإرسال إشعار"), text: "اضغط «إنهاء وإرسال إشعار»: يصل الطلب للاستقبال ويظهر في حساب المريض." },
    ], { clip: page.getByRole("dialog").last(), pad: 12 })
  })
  await ctx.close()
}

/* ================================================================ admin */
{
  const { ctx, page } = await session("admin@demo.test")
  await go(page, "/admin")
  await capture(page, "a-reports", "admin", "التقارير", "أداء المركز وكل طبيب خلال الفترة المختارة.", [
    { loc: page.getByText("هذا الشهر", { exact: true }).first(), text: "اختر الفترة: هذا الأسبوع، هذا الشهر، آخر 30 يومًا." },
    { loc: page.getByText("الإيرادات المحصّلة").first(), text: "المؤشرات: الحجوزات، نسبة الإشغال، نسبة الغياب، الإيرادات." },
    { loc: page.getByText("تصدير CSV").first(), text: "«تصدير CSV»: تنزيل التقرير لفتحه في Excel." },
  ])
  await go(page, "/admin/specialties")
  await capture(page, "a-specialties", "admin", "التخصصات", "التخصصات التي تظهر للمرضى عند الحجز.", [
    { loc: btn(page, "إضافة تخصص"), text: "«إضافة تخصص» جديد." },
    { loc: page.locator("main article h2 a").first(), text: "اضغط على بطاقة التخصص لفتح أطبائه وإضافة طبيب أو تعديله." },
    { loc: page.locator("main article").first().getByRole("button").first(), text: "القلم: تعديل اسم التخصص ووصفه وأيقونته." },
  ])
  await go(page, "/admin/doctors?specialty=1")
  await capture(page, "a-doctors", "admin", "الأطباء", "بيانات الأطباء وأسعارهم وجداول عملهم، مقسمة حسب التخصص.", [
    { loc: page.locator('button[role="tab"][aria-selected="true"]'), text: "اختر التخصص لعرض أطبائه فقط." },
    { loc: btn(page, "إضافة طبيب"), text: "«إضافة طبيب»: الاسم والمسمى والخبرة وسعر الكشف وسعر المراجعة (0 = مجانية)." },
    { loc: btn(page, "جدول العمل").first(), text: "«جدول العمل»: أيام وساعات عمل الطبيب." },
    { loc: page.locator("main table tbody tr").nth(1).getByRole("button").last(), text: "القلم: تعديل بيانات الطبيب أو إيقافه." },
  ])
  await go(page, "/admin/time-off")
  await step("time off dialog", async () => {
    await btn(page, "إضافة إجازة").first().click()
    await page.waitForTimeout(1000)
    const dlg = page.getByRole("dialog")
    await capture(page, "a-timeoff", "admin", "الإجازات", "إجازة طبيب أو عطلة رسمية للمركز كله؛ تُغلق مواعيدها فلا يحجزها أحد.", [
      { loc: dlg.getByText("لمن؟"), text: "لمن الإجازة: طبيب محدد أو المركز كله." },
      { loc: dlg.getByText("يوم كامل").first(), text: "يوم كامل أو جزء من اليوم." },
      { loc: dlg.getByText(/إلغاء الحجوزات المتأثرة/), text: "إن وُجدت حجوزات في الإجازة: ألغها مع استرداد المبلغ وإبلاغ المرضى." },
      { loc: dlg.getByRole("button", { name: /حفظ|إضافة/ }).last(), text: "احفظ الإجازة." },
    ], { clip: dlg, pad: 12 })
    await page.keyboard.press("Escape")
  })
  await go(page, "/admin/staff")
  await capture(page, "a-staff", "admin", "الموظفون", "حسابات الاستقبال والأطباء والإدارة.", [
    { loc: btn(page, "إضافة موظف"), text: "«إضافة موظف»: الاسم والبريد والجوال والدور وكلمة المرور." },
    { loc: page.locator("main table tbody tr").first(), text: "كل حساب ودوره وحالته (نشط / موقوف)." },
    { loc: page.locator("main table tbody tr").first().getByRole("button").last(), text: "تعديل الحساب أو إيقافه." },
  ])
  await go(page, "/admin/settings")
  await capture(page, "a-settings", "admin", "الإعدادات", "قواعد الحجز؛ أي تغيير يُطبَّق فورًا على الحجوزات الجديدة.", [
    { loc: page.getByText("أقل مدة قبل الموعد (ساعات)").first(), text: "قواعد الحجز: أقل مدة قبل الموعد، وأقصى مدة للحجز مقدمًا، وعدد الكشوفات في اليوم." },
    { loc: page.getByText("آخر مهلة للتعديل والإلغاء (ساعات قبل الموعد)").first(), text: "مهلة التعديل والإلغاء للمريض." },
    { loc: page.getByText("التذكير قبل الموعد بـ (ساعات)").first(), text: "مواعيد الإلغاء التلقائي والتذكير ومدة انتظار الدفع." },
    { loc: btn(page, "حفظ").last(), text: "اضغط «حفظ»." },
  ])
  await go(page, "/admin/refunds")
  await capture(page, "a-refunds", "admin", "الاستردادات المعلّقة", "حجوزات أُلغيت لكن بوابة الدفع رفضت إرجاع مبلغها.", [
    { loc: page.locator("main h1").first(), text: "إن وُجدت حالة هنا، اضغط «إعادة المحاولة» بجانبها حتى يُسترد المبلغ للمريض." },
  ])
  await ctx.close()
}

fs.writeFileSync(root + "screens.json", JSON.stringify(screens, null, 1))
await browser.close()
console.log("screens:", screens.length)
