// Screenshots for the user guide: drives the running app (Vite :5173 → API :8000) in headless Edge.
import { chromium } from "playwright-core"
import fs from "node:fs"

const BASE = "http://localhost:5173"
const OUT = new URL("./out/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: "msedge", headless: true })
const log = (...a) => console.log(...a)

async function session(email) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 }, deviceScaleFactor: 1, locale: "ar-SA", colorScheme: "light" })
  await ctx.addInitScript(() => {
    localStorage.setItem("clinic-theme", "light")
    localStorage.setItem("clinic-locale", "ar")
  })
  const page = await ctx.newPage()
  if (email) {
    await page.goto(BASE + "/login")
    await page.waitForSelector("#email")
    await page.fill("#email", email)
    await page.fill("#password", "password")
    await page.click('button[type="submit"]')
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 })
    await page.waitForTimeout(1500)
  }
  return { ctx, page }
}

async function shot(page, name, { el, full = false } = {}) {
  try {
    await page.waitForTimeout(900)
    const path = OUT + name + ".png"
    if (el) await page.locator(el).first().screenshot({ path })
    else await page.screenshot({ path, fullPage: full })
    log("ok", name)
  } catch (e) {
    log("FAIL", name, e.message.split("\n")[0])
  }
}

async function step(name, fn) {
  try {
    await fn()
  } catch (e) {
    log("FAIL", name, e.message.split("\n")[0])
  }
}

async function go(page, path) {
  await page.goto(BASE + path)
  await page.waitForLoadState("networkidle").catch(() => {})
  await page.waitForTimeout(1800)
}

/* ------------------------------------------------------------ public */
{
  const { ctx, page } = await session()
  await go(page, "/")
  await shot(page, "01-landing")
  await go(page, "/login")
  await shot(page, "02-login")
  await go(page, "/register")
  await shot(page, "03-register")
  await ctx.close()
}

/* ------------------------------------------------------------ patient */
{
  const { ctx, page } = await session("patient@demo.test")
  await go(page, "/my")
  await shot(page, "10-my-appointments")
  await step("reschedule", async () => {
    await page.getByRole("button", { name: "تغيير الموعد" }).first().click()
    await page.waitForTimeout(1800)
    await shot(page, "11-reschedule-dialog")
    await page.keyboard.press("Escape")
  })

  await go(page, "/new")
  await shot(page, "12-book-specialty")
    await ctx.close()
}

/* ------------------------------------------------------------ reception */
{
  const { ctx, page } = await session("staff@demo.test")
  await go(page, "/staff")
  await shot(page, "20-staff-dashboard")
  await shot(page, "21-staff-dashboard-full", { full: true })
  await step("follow-ups", async () => {
    await shot(page, "22-follow-up-queue", { el: 'section[aria-labelledby="follow-ups-title"]' })
    await shot(page, "23-pending-queue", { el: 'section[aria-labelledby="pending-title"]' })
  })
  await step("search", async () => {
    const box = page.getByPlaceholder("ابحث عن مريض بالاسم أو رقم الهوية أو الجوال")
    await box.fill("نورة")
    await page.waitForTimeout(1800)
    await page.locator("main").getByRole("button").filter({ hasText: "نورة" }).first().click().catch(() => {})
    await page.waitForTimeout(1500)
    await shot(page, "24-patient-search")
    await box.fill("")
  })
  await step("collect", async () => {
    await page.getByRole("button", { name: /تحصيل/ }).first().click()
    await page.waitForTimeout(1200)
    await shot(page, "25-collect-dialog")
    await page.keyboard.press("Escape")
  })
  await step("bell", async () => {
    await page.getByRole("button", { name: /التنبيهات/ }).click()
    await page.waitForTimeout(1000)
    await shot(page, "26-bell")
    await page.keyboard.press("Escape")
  })
    await ctx.close()
}


/* ------------------------------------------------------------ admin */
{
  const { ctx, page } = await session("admin@demo.test")
  for (const [path, name] of [
    ["/admin", "40-admin-reports"],
    ["/admin/specialties", "41-admin-specialties"],
    ["/admin/doctors?specialty=1", "42-admin-doctors"],
    ["/admin/time-off", "43-admin-time-off"],
    ["/admin/staff", "44-admin-staff"],
    ["/admin/settings", "45-admin-settings"],
    ["/admin/refunds", "46-admin-refunds"],
  ]) {
    await go(page, path)
    await shot(page, name)
  }
  await ctx.close()
}

await browser.close()
