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


async function bookFlow(page, prefix, staffSearch) {
  await go(page, "/new")
  await page.locator("main section button[aria-pressed]").first().click()
  await page.waitForTimeout(1500)
  await page.locator("main section button[aria-pressed]").first().click()
  await page.waitForTimeout(2800)
  await page.locator('section[aria-label="اختر الوقت"] button:not([disabled])').first().click()
  await page.waitForTimeout(500)
  await shot(page, prefix + "-time-picked")
  await page.getByRole("button", { name: "التالي", exact: true }).last().click()
  await page.waitForTimeout(1500)
  if (staffSearch) {
    await page.getByPlaceholder("ابحث برقم الجوال أو الهوية أو الاسم").fill(staffSearch)
    await page.waitForTimeout(2000)
  }
  await shot(page, prefix + "-patient")
  await page.locator("main section button[aria-pressed]:not([disabled])").first().click()
  await page.getByRole("button", { name: "التالي", exact: true }).last().click()
  await page.waitForTimeout(1500)
  await shot(page, prefix + "-confirm")
}

{
  const { ctx, page } = await session("patient@demo.test")
  await step("patient book", () => bookFlow(page, "15-book", null))
  await ctx.close()
}
{
  const { ctx, page } = await session("staff@demo.test")
  await step("staff book", () => bookFlow(page, "27-quick-book", "050"))
  await ctx.close()
}
{
  const { ctx, page } = await session("doctor@demo.test")
  await go(page, "/doctor")
  await shot(page, "30-doctor-week")
  await step("doctor", async () => {
    await page.getByText("يوم", { exact: true }).first().click()
    await page.waitForTimeout(1500)
    await shot(page, "31-doctor-day")
    await page.locator("ol button").first().click()
    await page.waitForTimeout(1500)
    await shot(page, "32-appointment-sheet")
    await page.getByRole("button", { name: "إنهاء الكشف" }).first().click()
    await page.waitForTimeout(1000)
    await page.getByRole("switch").first().click()
    await page.waitForTimeout(2800)
    await shot(page, "33-complete-book-now")
    await page.getByRole("radio", { name: "اطلب من الاستقبال" }).click()
    await page.waitForTimeout(1200)
    await shot(page, "34-complete-request")
    await go(page, "/doctor")
    await page.getByRole("button", { name: /التنبيهات/ }).click()
    await page.waitForTimeout(1000)
    await shot(page, "35-doctor-bell")
  })
  await ctx.close()
}
await browser.close()
