import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, parse, startOfMonth, startOfWeek } from "date-fns"
import { ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react"
import { motion } from "motion/react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useLocale } from "@/i18n"
import { getAvailability, getSlots } from "@/lib/api"
import type { DayAvailability, Role, Slot } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface SlotValue {
  date?: string
  start?: string
}

const ymd = (d: Date) => format(d, "yyyy-MM-dd")

export function SlotPicker({
  doctorId,
  role,
  value,
  onChange,
  ignoreId,
  compact = false,
}: {
  doctorId: number
  role: Role
  value: SlotValue
  onChange: (value: SlotValue) => void
  ignoreId?: number
  /** Inside a dialog: no lead-time note (the dialog states it) */
  compact?: boolean
}) {
  const { sep, t, num, time, fdate, dir, lang } = useLocale()

  const days = useQuery({ queryKey: ["availability", doctorId, role], queryFn: () => getAvailability(doctorId) })
  const slots = useQuery({
    queryKey: ["slots", doctorId, value.date, role, ignoreId],
    queryFn: () => getSlots(doctorId, value.date!, ignoreId),
    enabled: !!value.date,
  })

  const byDate = useMemo(() => new Map((days.data ?? []).map((d) => [d.date, d])), [days.data])
  const first = days.data?.[0] ? parse(days.data[0].date, "yyyy-MM-dd", new Date()) : new Date()
  const last = days.data?.length ? parse(days.data[days.data.length - 1].date, "yyyy-MM-dd", new Date()) : first
  const [month, setMonth] = useState<Date>(() => startOfMonth(value.date ? parse(value.date, "yyyy-MM-dd", new Date()) : new Date()))

  // Default to the first open day, and show its month
  useEffect(() => {
    if (!value.date && days.data) {
      const open = days.data.find((d) => d.status === "available")
      if (open) {
        onChange({ date: open.date })
        setMonth(startOfMonth(parse(open.date, "yyyy-MM-dd", new Date())))
      }
    }
  }, [days.data, value.date, onChange])

  // A Gregorian month spans two Hijri months: "ربيع الآخر – جمادى الأولى ١٤٤٨ هـ"
  const hijriFmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-ca-islamic-umalqura" : "en-SA-u-ca-islamic-umalqura", opts)
  const [hStart, hEnd] = [startOfMonth(month), endOfMonth(month)].map((d) => hijriFmt({ month: "long", year: "numeric" }).format(d))
  const sameHijriYear = hStart.replace(/^\D+/, "") === hEnd.replace(/^\D+/, "")
  const hijriSpan =
    hStart === hEnd ? hStart : `${sameHijriYear ? hijriFmt({ month: "long" }).format(startOfMonth(month)) : hStart} – ${hEnd}`

  // Sunday-first weeks, as on Saudi calendars
  const cells = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) })
  const weekdays = t("book.weekdaysShort", { returnObjects: true }) as string[]
  const canPrev = startOfMonth(month) > startOfMonth(first)
  const canNext = startOfMonth(month) < startOfMonth(last)
  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft
  const Next = dir === "rtl" ? ChevronLeft : ChevronRight

  const groups = (list: Slot[]) => [
    { key: "morning", icon: Sun, label: t("book.morning"), items: list.filter((s) => s.start < "14:00") },
    { key: "evening", icon: Moon, label: t("book.evening"), items: list.filter((s) => s.start >= "14:00") },
  ]
  // Columns follow the width of the times panel, not the screen: beside the calendar and the booking summary
  // it can be narrow even on a 1280px screen, and "١١:٣٠ ص" must stay on one line
  const slotGrid = "grid grid-cols-3 gap-2 @sm:grid-cols-4 @xl:grid-cols-5"
  const selectedDay = value.date ? parse(value.date, "yyyy-MM-dd", new Date()) : undefined
  const selectedFree = value.date ? byDate.get(value.date)?.free : undefined

  const statusLabel = (status?: DayAvailability, free?: number) =>
    status === "available" ? t("book.freeSlots", { n: num(free ?? 0) }) : status === "full" ? t("book.full") : t("book.off")

  return (
    // Calendar beside the times on wide screens, stacked on phones; min-w-0 keeps it inside dialogs
    <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:gap-8">
      <section aria-label={t("book.chooseDay")}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold">{fdate(month, "MMMM yyyy")}</h3>
            <p className="truncate text-xs text-muted-foreground">{hijriSpan}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" disabled={!canPrev} onClick={() => setMonth((m) => addMonths(m, -1))} aria-label={t("doctor.prev")}>
              <Prev className="size-4" />
            </Button>
            <Button variant="outline" size="icon-sm" disabled={!canNext} onClick={() => setMonth((m) => addMonths(m, 1))} aria-label={t("doctor.next")}>
              <Next className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdays.map((w) => (
            <span key={w} className="pb-1 text-[11px] font-medium text-muted-foreground">
              {w}
            </span>
          ))}
          {days.isLoading
            ? Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)
            : cells.map((d) => {
                const key = ymd(d)
                const info = byDate.get(key)
                const inMonth = isSameMonth(d, month)
                const open = info?.status === "available"
                const selected = value.date === key
                if (!inMonth) return <span key={key} aria-hidden="true" />
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!open}
                    aria-pressed={selected}
                    aria-label={`${fdate(d, "EEEE d MMMM")}${sep}${info ? statusLabel(info.status, info.free) : t("book.off")}`}
                    onClick={() => onChange({ date: key })}
                    className={cn(
                      "relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl text-sm font-semibold tabular transition-colors",
                      open ? "hover:bg-primary/10" : "cursor-not-allowed font-normal text-muted-foreground/45",
                      isToday(d) && !selected && "ring-1 ring-primary/40",
                      selected && "text-primary-foreground",
                    )}
                  >
                    {selected && (
                      <motion.span
                        layoutId={`day-${doctorId}-${ignoreId ?? "new"}`}
                        className="absolute inset-0 rounded-xl bg-primary shadow-soft"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    {/* On the number itself: text-decoration doesn't reach a flex item from its parent */}
                    <span className={cn("relative", info?.status === "full" && "line-through decoration-2 decoration-muted-foreground/60")}>
                      {num(d.getDate())}
                    </span>
                    {open && <span className={cn("relative mt-0.5 size-1 rounded-full", selected ? "bg-primary-foreground" : "bg-success")} />}
                  </button>
                )
              })}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-success" />
            {t("book.legendOpen")}
          </span>
          <span className="line-through decoration-muted-foreground/60">{t("book.full")}</span>
          <span className="opacity-60">{t("book.off")}</span>
        </div>
        {role === "patient" && !compact && <p className="mt-3 text-xs text-muted-foreground">{t("book.leadTimeNote")}</p>}
      </section>

      <section aria-label={t("book.chooseSlot")} className="@container min-w-0">
        <div className="mb-3">
          <h3 className="font-semibold">{t("book.chooseSlot")}</h3>
          {selectedDay && (
            <p className="text-xs text-muted-foreground">
              {fdate(selectedDay, "EEEE d MMMM")}
              {selectedFree !== undefined && `${sep}${t("book.freeSlots", { n: num(selectedFree) })}`}
            </p>
          )}
        </div>
        {slots.isLoading || !value.date ? (
          <div className={slotGrid}>
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
        ) : slots.data && slots.data.some((s) => s.available) ? (
          <div className="space-y-5">
            {groups(slots.data)
              .filter((g) => g.items.length)
              .map((g) => (
                <div key={g.key}>
                  <p className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <g.icon className="size-4" aria-hidden="true" />
                    {g.label}
                  </p>
                  <motion.div
                    key={value.date}
                    initial="hidden"
                    animate="show"
                    variants={{ show: { transition: { staggerChildren: 0.02 } } }}
                    className={slotGrid}
                  >
                    {g.items.map((s) => {
                      const selected = value.start === s.start
                      return (
                        <motion.button
                          key={s.start}
                          type="button"
                          variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                          whileTap={s.available ? { scale: 0.95 } : undefined}
                          disabled={!s.available}
                          aria-pressed={selected}
                          onClick={() => onChange({ date: value.date, start: s.start })}
                          className={cn(
                            "h-10 cursor-pointer rounded-xl text-sm font-medium tabular transition-colors",
                            selected ? "bg-primary text-primary-foreground shadow-soft" : "bg-muted/70 hover:bg-primary/10 hover:text-primary",
                            !s.available && "cursor-not-allowed bg-muted/30 text-muted-foreground line-through opacity-60 hover:bg-muted/30 hover:text-muted-foreground",
                          )}
                        >
                          {time(s.start)}
                        </motion.button>
                      )
                    })}
                  </motion.div>
                </div>
              ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">{t("book.noSlots")}</p>
        )}
      </section>
    </div>
  )
}
