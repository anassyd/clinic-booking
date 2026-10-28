import { format } from "date-fns"
import { arSA, enUS } from "date-fns/locale"
import i18n from "i18next"
import { initReactI18next, useTranslation } from "react-i18next"

import type { Locale, Translatable } from "@/lib/types"

import ar from "./ar"
import en from "./en"

const STORAGE_KEY = "clinic-locale"

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === "ar" || saved === "en") return saved
  } catch {
    /* ignore */
  }
  return "ar"
}

function applyDocument(locale: Locale) {
  document.documentElement.lang = locale
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr"
}

const locale = initialLocale()
applyDocument(locale)

i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: locale,
  fallbackLng: "ar",
  interpolation: { escapeValue: false },
  returnObjects: true,
})

i18n.on("languageChanged", (lng) => {
  applyDocument(lng as Locale)
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    /* ignore */
  }
})

/** Locale helpers shared by every page. */
export function useLocale() {
  const { t, i18n: instance } = useTranslation()
  const lang = (instance.language === "en" ? "en" : "ar") as Locale
  const dir = lang === "ar" ? "rtl" : "ltr"
  const nf = new Intl.NumberFormat(lang === "ar" ? "ar-SA" : "en-US")
  return {
    t,
    lang,
    dir: dir as "rtl" | "ltr",
    /** Between inline facts ("Tue 4 Nov · 9:00"). Arabic uses "،": a "·" beside Arabic-Indic digits reads as ٠ */
    sep: lang === "ar" ? "، " : " · ",
    dateLocale: lang === "ar" ? arSA : enUS,
    tr: (value?: Translatable | null) => value?.[lang] ?? "",
    /** date-fns format with Arabic-Indic digits in Arabic */
    fdate: (date: Date, pattern: string) => {
      const out = format(date, pattern, { locale: lang === "ar" ? arSA : enUS })
      return lang === "ar" ? out.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]) : out
    },
    /** Umm al-Qura date, e.g. "١٦ جمادى الأولى ١٤٤٨ هـ" — shown next to Gregorian dates */
    hijri: (date: Date) =>
      new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-ca-islamic-umalqura" : "en-SA-u-ca-islamic-umalqura", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date),
    /** Short weekday for compact cells: arSA abbreviations ("ثلا") read badly, so Arabic uses the full name */
    wday: (date: Date) => format(date, lang === "ar" ? "EEEE" : "EEE", { locale: lang === "ar" ? arSA : enUS }),
    num: (n: number) => nf.format(n),
    money: (n: number) => `${nf.format(n)} ${t("common.currency")}`,
    /** "14:30" → "2:30 م" / "2:30 PM" */
    time: (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number)
      return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA" : "en-US", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(2000, 0, 1, h, m))
    },
    toggle: () => instance.changeLanguage(lang === "ar" ? "en" : "ar"),
  }
}

export default i18n
