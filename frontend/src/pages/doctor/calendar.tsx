import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { CalendarCheck2, ChevronLeft, ChevronRight, Info, Mail, Phone, Repeat2, StickyNote, UserRound, UserX } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { SlotPicker, type SlotValue } from "@/components/shared/slot-picker"
import { STATUS_DOT, StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useLocale } from "@/i18n"
import { ageOf, buildSlots, completeAppointment, getDoctorAppointments, getDoctorSync, getPatientSync, markNoShow, toDateTime } from "@/lib/api"
import { errorMessage } from "@/lib/errors"
import type { Appointment, AppointmentStatus, Doctor } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAuth } from "@/providers/auth"

type View = "day" | "week" | "month"
const WEEK = { weekStartsOn: 6 as const } // Saturday
const ISO = "yyyy-MM-dd"

const BLOCK: Record<AppointmentStatus, string> = {
  held: "border-chart-3/40 bg-chart-3/10",
  pending: "border-warning/50 bg-warning/12",
  confirmed: "border-primary/35 bg-primary/8",
  completed: "border-success/35 bg-success/8",
  no_show: "border-border bg-muted",
  cancelled: "border-destructive/25 bg-destructive/5 line-through opacity-60",
}

/* ------------------------------------------------------------------ */

function AppointmentBlock({ appt, compact, onOpen }: { appt: Appointment; compact?: boolean; onOpen: () => void }) {
  const { sep, t, time } = useLocale()
  const p = getPatientSync(appt.patientId)
  return (
    <motion.button
      layout
      type="button"
      onClick={onOpen}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-2 rounded-xl border px-2.5 text-start transition-shadow hover:shadow-soft focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "h-full py-1 text-xs" : "py-2.5 text-sm",
        BLOCK[appt.status],
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[appt.status])} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{p?.name}</span>
        {!compact && (
          <span className="block text-xs text-muted-foreground">
            {time(appt.start)}{sep}{t(`type.${appt.type}`)}
          </span>
        )}
      </span>
      {appt.type === "follow_up" && <Repeat2 className="size-3.5 shrink-0 text-accent-foreground" aria-label={t("type.follow_up")} />}
      {!compact && <StatusBadge status={appt.status} className="hidden sm:inline-flex" />}
    </motion.button>
  )
}

function DayView({ doctor, date, appts, onOpen }: { doctor: Doctor; date: Date; appts: Appointment[]; onOpen: (a: Appointment) => void }) {
  const { t, time } = useLocale()
  const schedule = doctor.schedules.find((s) => s.dayOfWeek === date.getDay())
  if (!schedule) return <p className="p-16 text-center text-muted-foreground">{t("book.off")}</p>
  const iso = format(date, ISO)
  const now = format(new Date(), "HH:mm")
  return (
    <ol className="divide-y">
      {buildSlots(schedule.start, schedule.end).map((slot) => {
        const appt = appts.find((a) => a.date === iso && a.start === slot.start && a.status !== "cancelled")
        const current = isToday(date) && now >= slot.start && now < slot.end
        return (
          <li key={slot.start} className={cn("relative flex items-center gap-4 px-4 py-2 sm:px-5", current && "bg-primary/5")}>
            {current && <span className="absolute inset-y-0 start-0 w-1 rounded-e bg-primary" aria-hidden="true" />}
            <span className={cn("w-16 shrink-0 text-sm tabular", current ? "font-semibold text-primary" : "text-muted-foreground")}>
              {time(slot.start)}
            </span>
            <div className="min-w-0 flex-1">
              {appt ? (
                <AppointmentBlock appt={appt} onOpen={() => onOpen(appt)} />
              ) : (
                <div className="rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground">{t("doctor.free")}</div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function WeekView({
  doctor,
  date,
  appts,
  onOpen,
  onPickDay,
}: {
  doctor: Doctor
  date: Date
  appts: Appointment[]
  onOpen: (a: Appointment) => void
  onPickDay: (d: Date) => void
}) {
  const { time, num, wday } = useLocale()
  const days = eachDayOfInterval({
    start: startOfWeek(date, WEEK),
    end: addDays(startOfWeek(date, WEEK), 5),
  }) // Sat → Thu
  const shift = doctor.schedules[0]
  const slots = buildSlots(shift.start, shift.end)

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[760px]"
        style={{
          gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))`,
        }}
      >
        <div className="sticky top-0 border-b bg-card" />
        {days.map((d) => (
          <button
            key={d.toISOString()}
            type="button"
            onClick={() => onPickDay(d)}
            className={cn("cursor-pointer border-b border-s px-2 py-3 text-center hover:bg-muted/60", isToday(d) && "bg-primary/5")}
          >
            <p className="text-xs text-muted-foreground">{wday(d)}</p>
            <p
              className={cn(
                "mx-auto mt-0.5 grid size-8 place-items-center rounded-full text-sm font-bold tabular",
                isToday(d) && "bg-primary text-primary-foreground",
              )}
            >
              {num(d.getDate())}
            </p>
          </button>
        ))}
        {slots.map((slot) => (
          <div key={slot.start} className="contents">
            <div className="border-b px-2 py-1 text-end text-[11px] text-muted-foreground tabular">
              {slot.start.endsWith("00") ? time(slot.start) : ""}
            </div>
            {days.map((d) => {
              const iso = format(d, ISO)
              const appt = appts.find((a) => a.date === iso && a.start === slot.start && a.status !== "cancelled")
              return (
                <div key={iso} className={cn("h-11 border-s border-b p-0.5", isToday(d) && "bg-primary/[0.03]")}>
                  {appt && <AppointmentBlock appt={appt} compact onOpen={() => onOpen(appt)} />}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function MonthView({ date, appts, onPickDay }: { date: Date; appts: Appointment[]; onPickDay: (d: Date) => void }) {
  const { t, num, wday } = useLocale()
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(date), WEEK),
    end: endOfWeek(endOfMonth(date), WEEK),
  })
  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const a of appts) if (a.status !== "cancelled") map.set(a.date, [...(map.get(a.date) ?? []), a])
    return map
  }, [appts])

  return (
    <div>
      <div className="grid grid-cols-7 border-b">
        {days.slice(0, 7).map((d) => (
          <p key={d.toISOString()} className="py-2 text-center text-xs font-medium text-muted-foreground">
            {wday(d)}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = byDay.get(format(d, ISO)) ?? []
          const friday = d.getDay() === 5
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onPickDay(d)}
              disabled={friday}
              className={cn(
                "group min-h-24 cursor-pointer border-e border-b p-2 text-start transition-colors hover:bg-muted/60 sm:min-h-28",
                !isSameMonth(d, date) && "bg-muted/30 text-muted-foreground",
                friday &&
                  "cursor-not-allowed bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--muted)_6px,var(--muted)_7px)] hover:bg-transparent",
              )}
            >
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full text-sm font-semibold tabular",
                  isToday(d) && "bg-primary text-primary-foreground",
                )}
              >
                {num(d.getDate())}
              </span>
              {list.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium">{t("doctor.appointments", { n: num(list.length) })}</p>
                  <div className="flex flex-wrap gap-0.5">
                    {list.slice(0, 12).map((a) => (
                      <span key={a.id} className={cn("size-1.5 rounded-full", STATUS_DOT[a.status])} />
                    ))}
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

/** "Follow up within" shortcuts, in days */
const FOLLOW_UP_PRESETS = [7, 14, 30, 90] as const

export default function DoctorCalendar() {
  const { sep, t, tr, time, money, fdate, num, dir, hijri } = useLocale()
  const { user } = useAuth()
  const qc = useQueryClient()
  const doctor = getDoctorSync(user!.doctorId!)!
  const [view, setView] = useState<View>("week")
  const [cursor, setCursor] = useState(new Date())
  const [openId, setOpenId] = useState<number | null>(null)
  const [completing, setCompleting] = useState(false)
  const [followUp, setFollowUp] = useState(false)
  const inDays = (n: number) => format(addDays(new Date(), n), ISO)
  const [due, setDue] = useState(() => inDays(14))
  const [followUpNote, setFollowUpNote] = useState("")
  // Book the follow-up now, or leave it to reception / the patient
  const [followUpMode, setFollowUpMode] = useState<"book" | "request">("book")
  const [slot, setSlot] = useState<SlotValue>({})
  const bookingNow = followUp && followUpMode === "book"

  const range = useMemo(() => {
    if (view === "day") return { from: cursor, to: cursor }
    if (view === "week") return { from: startOfWeek(cursor, WEEK), to: endOfWeek(cursor, WEEK) }
    return {
      from: startOfWeek(startOfMonth(cursor), WEEK),
      to: endOfWeek(endOfMonth(cursor), WEEK),
    }
  }, [view, cursor])

  const q = useQuery({
    queryKey: ["appointments", "doctor", doctor.id, format(range.from, ISO), format(range.to, ISO)],
    queryFn: () => getDoctorAppointments(format(range.from, ISO), format(range.to, ISO)),
    placeholderData: (prev) => prev,
  })
  const appts = q.data ?? []
  const open = appts.find((a) => a.id === openId)
  const patient = open && getPatientSync(open.patientId)

  const shift = (sign: 1 | -1) => setCursor((c) => (view === "day" ? addDays(c, sign) : view === "week" ? addWeeks(c, sign) : addMonths(c, sign)))

  const title =
    view === "day"
      ? fdate(cursor, "EEEE d MMMM yyyy")
      : view === "week"
        ? `${fdate(range.from, "d MMMM")} – ${fdate(range.to, "d MMMM yyyy")}`
        : fdate(cursor, "MMMM yyyy")

  const complete = useMutation({
    mutationFn: () =>
      completeAppointment(open!.id, !followUp ? undefined : bookingNow ? { due: slot.date!, start: slot.start } : { due, note: followUpNote }),
    onSuccess: (res) => {
      if (res.followUp) {
        toast.success(t("doctor.followUpBooked"), {
          description: `${fdate(parse(res.followUp.date, ISO, new Date()), "EEEE d MMMM")}${sep}${time(res.followUp.start)}`,
        })
      } else {
        toast.success(t(followUp ? "doctor.followUpSent" : "doctor.completed"))
      }
      setCompleting(false)
      setFollowUp(false)
      setDue(inDays(14))
      setFollowUpNote("")
      setSlot({})
      qc.invalidateQueries({ queryKey: ["slots"] })
      qc.invalidateQueries({ queryKey: ["availability"] })
      qc.invalidateQueries({ queryKey: ["appointments"] })
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  })

  const noShow = useMutation({
    mutationFn: () => markNoShow(open!.id, true),
    onSuccess: () => {
      toast.success(t("status.no_show"))
      qc.invalidateQueries({ queryKey: ["appointments"] })
    },
  })

  const pickDay = (d: Date) => {
    setCursor(d)
    setView("day")
  }

  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft
  const Next = dir === "rtl" ? ChevronLeft : ChevronRight
  const visible = appts.filter((a) => a.status !== "cancelled")
  const todays = visible.filter((a) => isSameDay(parse(a.date, ISO, new Date()), new Date()))

  return (
    <>
      <PageHeader
        title={t("doctor.title")}
        subtitle={`${tr(doctor.name)} — ${t("doctor.appointments", { n: num(todays.length) })} ${t("staff.today")}`}
      />

      <div className="rounded-3xl border bg-card shadow-soft">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label={t("doctor.prev")}>
              <Prev className="size-4" />
            </Button>
            <Button variant="outline" onClick={() => setCursor(new Date())}>
              {t("doctor.today")}
            </Button>
            <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label={t("doctor.next")}>
              <Next className="size-4" />
            </Button>
            <AnimatePresence mode="wait">
              <motion.h2
                key={title}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="ms-2 font-semibold"
                aria-live="polite"
              >
                {title}
              </motion.h2>
            </AnimatePresence>
            {q.isFetching && <Spinner className="size-4 text-muted-foreground" />}
          </div>
          <div className="flex rounded-xl bg-muted p-1" role="tablist" aria-label={t("nav.calendar")}>
            {(["day", "week", "month"] as View[]).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "relative cursor-pointer rounded-lg px-4 py-1.5 text-sm font-medium",
                  view === v ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {view === v && (
                  <motion.span
                    layoutId="cal-view"
                    className="absolute inset-0 rounded-lg bg-card shadow-sm"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{t(`doctor.views.${v}`)}</span>
              </button>
            ))}
          </div>
        </div>

        {q.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-11 rounded-xl" />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${view}-${format(range.from, ISO)}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              {view === "day" && <DayView doctor={doctor} date={cursor} appts={appts} onOpen={(a) => setOpenId(a.id)} />}
              {view === "week" && <WeekView doctor={doctor} date={cursor} appts={appts} onOpen={(a) => setOpenId(a.id)} onPickDay={pickDay} />}
              {view === "month" && <MonthView date={cursor} appts={appts} onPickDay={pickDay} />}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-5 py-3 text-xs text-muted-foreground">
          <span className="font-medium">{t("doctor.legend")}</span>
          {(["pending", "confirmed", "completed", "no_show"] as AppointmentStatus[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", STATUS_DOT[s])} />
              {t(`status.${s}`)}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <Repeat2 className="size-3.5" aria-hidden="true" />
            {t("type.follow_up")}
          </span>
        </div>
      </div>

      {/* Details */}
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-full overflow-y-auto sm:max-w-md">
          {open && patient && (
            <>
              <SheetHeader>
                <SheetTitle>{t("doctor.details")}</SheetTitle>
                <SheetDescription>
                  {fdate(parse(open.date, ISO, new Date()), "EEEE d MMMM")}{sep}{time(open.start)} – {time(open.end)}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-6">
                <div className="flex items-center gap-4 rounded-2xl bg-muted/50 p-4">
                  <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <UserRound className="size-7" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-lg font-semibold">{patient.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {t(`patient.${patient.gender}`)}{sep}{t("patient.age", { n: num(ageOf(patient.birthDate)) })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={open.status} />
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                    {open.type === "follow_up" && <Repeat2 className="size-3.5" aria-hidden="true" />}
                    {t(`type.${open.type}`)}
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs tabular">
                    {money(open.price)}{sep}{t(`payment.${open.paymentStatus}`)}
                  </span>
                </div>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Phone className="size-4 text-muted-foreground" aria-hidden="true" />
                    <dt className="sr-only">{t("patient.phone")}</dt>
                    <dd>
                      <a href={`tel:${patient.phone}`} className="text-primary hover:underline" dir="ltr">
                        {patient.phone}
                      </a>
                    </dd>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
                    <dt className="sr-only">{t("patient.email")}</dt>
                    <dd className="break-all">{patient.email}</dd>
                  </div>
                  <div className="flex items-center gap-3">
                    <CalendarCheck2 className="size-4 text-muted-foreground" aria-hidden="true" />
                    <dt className="text-muted-foreground">{t("doctor.bookedBy")}:</dt>
                    <dd>{t(`roles.${open.bookedBy}`)}</dd>
                  </div>
                  {open.notes && (
                    <div className="flex gap-3">
                      <StickyNote className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
                      <dd className="rounded-xl bg-muted/60 p-3">{open.notes}</dd>
                    </div>
                  )}
                  {open.followUpDue && (
                    <div className="flex gap-3">
                      <Repeat2 className="mt-0.5 size-4 text-primary" aria-hidden="true" />
                      <dd>
                        {t("doctor.followUpRequested", {
                          date: fdate(parse(open.followUpDue, ISO, new Date()), "EEEE d MMMM"),
                        })}
                        {open.followUpNote && <span className="block text-muted-foreground">{open.followUpNote}</span>}
                      </dd>
                    </div>
                  )}
                </dl>
                {/* Finished on its day (or later), marked no-show once it has started; the server enforces both */}
                {open.status === "confirmed" && open.date <= format(new Date(), ISO) && (
                  <div className="flex flex-col gap-2 border-t pt-5">
                    <Button className="h-11 rounded-xl" onClick={() => setCompleting(true)}>
                      <CalendarCheck2 className="size-4" aria-hidden="true" />
                      {t("doctor.complete")}
                    </Button>
                    {toDateTime(open.date, open.start) <= new Date() && (
                      <Button variant="outline" className="h-11 rounded-xl" onClick={() => noShow.mutate()} disabled={noShow.isPending}>
                        <UserX className="size-4" aria-hidden="true" />
                        {t("staff.noShow")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Complete + follow-up */}
      <Dialog open={completing} onOpenChange={setCompleting}>
        <DialogContent className={cn("max-h-[90dvh] overflow-y-auto transition-[max-width]", bookingNow ? "sm:max-w-3xl" : "sm:max-w-lg")}>
          <DialogHeader>
            <DialogTitle>{t("doctor.completeTitle")}</DialogTitle>
            <DialogDescription>{patient?.name}</DialogDescription>
          </DialogHeader>
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border p-4">
            <span className="flex items-center gap-3 font-medium">
              <Repeat2 className="size-5 text-primary" aria-hidden="true" />
              {t("doctor.needFollowUp")}
            </span>
            <Switch checked={followUp} onCheckedChange={setFollowUp} />
          </label>
          <AnimatePresence initial={false}>
            {followUp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div role="radiogroup" aria-label={t("doctor.needFollowUp")} className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                  {(["book", "request"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={followUpMode === m}
                      onClick={() => setFollowUpMode(m)}
                      className={cn(
                        "relative h-9 cursor-pointer rounded-lg text-sm font-medium transition-colors",
                        followUpMode === m ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {followUpMode === m && (
                        <motion.span
                          layoutId="follow-up-mode"
                          className="absolute inset-0 rounded-lg bg-card shadow-soft"
                          transition={{
                            type: "spring",
                            stiffness: 450,
                            damping: 35,
                          }}
                        />
                      )}
                      <span className="relative">{t(m === "book" ? "doctor.followUpBookNow" : "doctor.followUpRequest")}</span>
                    </button>
                  ))}
                </div>
                {bookingNow ? (
                  <SlotPicker doctorId={doctor.id} role="doctor" value={slot} onChange={setSlot} compact />
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-sm font-semibold">{t("doctor.followUpWithin")}</p>
                      <div className="flex flex-wrap gap-2">
                        {FOLLOW_UP_PRESETS.map((n) => {
                          const value = inDays(n)
                          return (
                            <button
                              key={n}
                              type="button"
                              aria-pressed={due === value}
                              onClick={() => setDue(value)}
                              className={cn(
                                "h-9 cursor-pointer rounded-xl px-3.5 text-sm font-medium transition-colors",
                                due === value
                                  ? "bg-primary text-primary-foreground shadow-soft"
                                  : "bg-muted/70 hover:bg-primary/10 hover:text-primary",
                              )}
                            >
                              {t(`doctor.followUpPresets.${n}`)}
                            </button>
                          )
                        })}
                        <Input
                          type="date"
                          min={inDays(1)}
                          value={due}
                          onChange={(e) => e.target.value && setDue(e.target.value)}
                          aria-label={t("doctor.followUpOther")}
                          className="h-9 w-auto rounded-xl"
                        />
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t("doctor.followUpBy", {
                          date: `${fdate(parse(due, ISO, new Date()), "EEEE d MMMM")} (${hijri(parse(due, ISO, new Date()))})`,
                        })}
                      </p>
                    </div>
                    <div>
                      <label htmlFor="follow-up-note" className="mb-2 block text-sm font-semibold">
                        {t("doctor.followUpNote")}
                      </label>
                      <Textarea
                        id="follow-up-note"
                        value={followUpNote}
                        maxLength={500}
                        onChange={(e) => setFollowUpNote(e.target.value)}
                        placeholder={t("doctor.followUpNotePlaceholder")}
                        className="min-h-20 rounded-xl"
                      />
                    </div>
                    <p className="flex gap-2 rounded-xl bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
                      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      {t("doctor.followUpHow")}
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <DialogFooter>
            <Button
              className="h-11 rounded-xl px-6"
              disabled={complete.isPending || (bookingNow ? !slot.start : followUp && due <= inDays(0))}
              onClick={() => complete.mutate()}
            >
              {complete.isPending && <Spinner />}
              {t("doctor.saveComplete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
