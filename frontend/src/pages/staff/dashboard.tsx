import { useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format, formatDistanceToNowStrict } from "date-fns"
import {
  Banknote,
  CalendarCheck2,
  CalendarPlus,
  CheckCheck,
  Clock3,
  Hourglass,
  Phone,
  Plus,
  Repeat2,
  Search,
  Stethoscope,
  UserX,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { CountUp } from "@/components/shared/count-up"
import { CollectDialog } from "@/components/shared/desk-payment"
import { DoctorAvatar } from "@/components/shared/doctor-avatar"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLocale } from "@/i18n"
import {
  ageOf,
  buildSlots,
  catalog,
  confirmAppointment,
  getDoctorSync,
  getPatientSync,
  getPendingAppointments,
  getSpecialtySync,
  getStaffAppointments,
  markNoShow,
  toDateTime,
} from "@/lib/api"
import { errorMessage } from "@/lib/errors"
import type { Appointment } from "@/lib/types"
import { cn } from "@/lib/utils"

import { FollowUpQueue } from "./follow-ups"
import { PatientLookup } from "./patient-lookup"

/** Loose Arabic/English match: drops the "د." / "Dr." title and alef / taa marbuta / yaa variants. */
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/^\s*(د\.|dr\.?\s)\s*/, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim()

function Kpi({ icon: Icon, label, value, tone, delay }: { icon: typeof Clock3; label: string; value: number; tone: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl border bg-card p-5 shadow-soft"
    >
      <div className={cn("absolute -end-6 -top-6 size-24 rounded-full opacity-60 blur-2xl", tone)} />
      <span className={cn("relative grid size-10 place-items-center rounded-xl", tone)}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="relative mt-4 text-3xl font-extrabold tabular">
        <CountUp value={value} />
      </p>
      <p className="relative text-sm text-muted-foreground">{label}</p>
    </motion.div>
  )
}

export default function StaffDashboard() {
  const { sep, t, tr, time, dateLocale, fdate, num, money } = useLocale()
  const qc = useQueryClient()
  const today = format(new Date(), "yyyy-MM-dd")
  const { doctors } = catalog()
  const [doctorId, setDoctorId] = useState(doctors[0]?.id)
  const [collecting, setCollecting] = useState<Appointment>()
  const [doctorQuery, setDoctorQuery] = useState("")

  // Doctor name (either language) or specialty
  const matchesDoctor = (d: (typeof doctors)[number], q: string) => {
    const spec = getSpecialtySync(d.specialtyId)
    return [d.name.ar, d.name.en, spec?.name.ar, spec?.name.en].some((v) => v && normalize(v).includes(q))
  }
  const doctorTerm = normalize(doctorQuery)
  const shownDoctors = doctorTerm ? doctors.filter((d) => matchesDoctor(d, doctorTerm)) : doctors
  const searchDoctors = (value: string) => {
    setDoctorQuery(value)
    const q = normalize(value)
    const first = doctors.find((d) => !q || matchesDoctor(d, q))
    // Keep the current doctor while it still matches; otherwise jump to the first match
    if (first && q && !matchesDoctor(getDoctorSync(doctorId)!, q)) setDoctorId(first.id)
  }

  const todayQ = useQuery({ queryKey: ["appointments", "day", today], queryFn: () => getStaffAppointments(today, today) })
  const pendingQ = useQuery({ queryKey: ["appointments", "pending"], queryFn: getPendingAppointments })

  const act = useMutation({
    mutationFn: ({ fn, id }: { fn: (id: number) => Promise<Appointment>; id: number; msg: string }) => fn(id),
    onSuccess: (_d, v) => {
      toast.success(v.msg)
      qc.invalidateQueries({ queryKey: ["appointments"] })
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  })

  const all = todayQ.data ?? []
  const live = all.filter((a) => a.status !== "cancelled")
  const totalSlots = doctors.reduce((sum, d) => {
    const s = d.schedules.find((x) => x.dayOfWeek === new Date().getDay())
    return sum + (s ? buildSlots(s.start, s.end).length : 0)
  }, 0)

  const kpis = [
    { icon: CalendarCheck2, label: t("staff.kpis.total"), value: live.length, tone: "bg-primary/12 text-primary" },
    { icon: Hourglass, label: t("staff.kpis.pending"), value: pendingQ.data?.length ?? 0, tone: "bg-warning/20 text-warning-foreground dark:text-warning" },
    { icon: CheckCheck, label: t("staff.kpis.completed"), value: live.filter((a) => a.status === "completed").length, tone: "bg-success/12 text-success" },
    { icon: Clock3, label: t("staff.kpis.free"), value: Math.max(totalSlots - live.length, 0), tone: "bg-chart-3/15 text-foreground" },
  ]

  const doctor = getDoctorSync(doctorId)!
  const schedule = doctor.schedules.find((s) => s.dayOfWeek === new Date().getDay())
  const rows = schedule
    ? buildSlots(schedule.start, schedule.end).map((slot) => ({
        slot,
        appt: all.find((a) => a.doctorId === doctorId && a.start === slot.start && a.status !== "cancelled"),
      }))
    : []

  // The server sets the auto-cancel deadline (12 h after booking or 6 h before the visit)
  const expiry = (a: Appointment) => new Date(a.pendingExpiresAt ?? toDateTime(a.date, a.start))

  return (
    <>
      <PageHeader
        title={t("staff.title")}
        subtitle={`${t("staff.subtitle")}${sep}${fdate(new Date(), "EEEE d MMMM")}`}
        actions={
          <Button asChild className="rounded-xl shadow-soft">
            <Link to="/new">
              <CalendarPlus className="size-4" aria-hidden="true" />
              {t("staff.quickBook")}
            </Link>
          </Button>
        }
      />

      <PatientLookup onCollect={setCollecting} />
      <CollectDialog appointment={collecting} onOpenChange={(open) => !open && setCollecting(undefined)} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <Kpi key={k.label} {...k} delay={i * 0.06} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Schedule */}
        <section className="min-w-0 rounded-3xl border bg-card shadow-soft" aria-labelledby="schedule-title">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <h2 id="schedule-title" className="font-semibold">
              {t("staff.schedule")}
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                value={doctorQuery}
                onChange={(e) => searchDoctors(e.target.value)}
                placeholder={t("staff.searchDoctor")}
                aria-label={t("staff.searchDoctor")}
                className="h-10 rounded-xl ps-9"
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto border-b p-3" role="tablist">
            {shownDoctors.length === 0 && <p className="px-2 py-2.5 text-sm text-muted-foreground">{t("staff.doctorEmpty")}</p>}
            {shownDoctors.map((d) => {
              const count = live.filter((a) => a.doctorId === d.id).length
              const selected = d.id === doctorId
              return (
                <button
                  key={d.id}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setDoctorId(d.id)}
                  className={cn(
                    "relative flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl px-3 py-2 text-sm transition-colors",
                    selected ? "text-primary" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {selected && (
                    <motion.span layoutId="staff-doctor" className="absolute inset-0 rounded-2xl bg-primary/10 ring-1 ring-primary/30" />
                  )}
                  <DoctorAvatar doctor={d} className="relative size-8 rounded-lg text-[11px]" />
                  <span className="relative font-medium whitespace-nowrap">{tr(d.name)}</span>
                  <span className="relative rounded-full bg-background px-1.5 text-xs tabular">{num(count)}</span>
                </button>
              )
            })}
          </div>

          {todayQ.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-10 text-center text-muted-foreground">{t("book.off")}</p>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={doctorId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24 ps-5">{t("book.steps.time")}</TableHead>
                      <TableHead>{t("book.steps.patient")}</TableHead>
                      <TableHead className="hidden text-center md:table-cell">{t("patient.phone")}</TableHead>
                      <TableHead>{t("patient.gender")}</TableHead>
                      <TableHead>{t("staff.age")}</TableHead>
                      <TableHead className="text-end pe-5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(({ slot, appt }) => {
                      const patient = appt && getPatientSync(appt.patientId)
                      // Walk-ins: book an empty slot that hasn't started yet
                      const bookable = !appt && toDateTime(today, slot.start) > new Date()
                      return (
                        <TableRow key={slot.start} className={cn(!appt && "text-muted-foreground")}>
                          <TableCell className="ps-5 font-medium tabular">{time(slot.start)}</TableCell>
                          <TableCell>
                            {appt ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-foreground">{patient?.name}</span>
                                {appt.type === "follow_up" && (
                                  <Repeat2 className="size-4 text-accent-foreground" aria-label={t("type.follow_up")} />
                                )}
                                <StatusBadge status={appt.status} />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{t("staff.free")}</span>
                                {bookable && (
                                  <Button asChild size="sm" variant="outline" className="h-7 rounded-lg border-dashed border-primary/40 text-primary hover:bg-primary/5">
                                    <Link
                                      to={`/new?specialty=${doctor.specialtyId}&doctor=${doctor.id}&date=${today}&start=${slot.start}`}
                                      aria-label={t("staff.bookSlot", { time: time(slot.start) })}
                                    >
                                      <Plus className="size-3.5" aria-hidden="true" />
                                      {t("staff.book")}
                                    </Link>
                                  </Button>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="hidden text-center tabular md:table-cell">
                            <span dir="ltr">{patient?.phone}</span>
                          </TableCell>
                          <TableCell className="text-sm">{patient && t(`patient.${patient.gender}`)}</TableCell>
                          <TableCell className="text-sm tabular">{patient && num(ageOf(patient.birthDate))}</TableCell>
                          <TableCell className="pe-5">
                            {appt && (
                              <div className="flex justify-end gap-1">
                                {appt.status === "pending" && (
                                  <Button size="sm" className="h-8 rounded-lg" onClick={() => act.mutate({ fn: confirmAppointment, id: appt.id, msg: t("staff.confirmed") })}>
                                    {t("staff.confirm")}
                                  </Button>
                                )}
                                {appt.paymentStatus === "unpaid" && appt.price > 0 && appt.status !== "no_show" && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-lg"
                                        onClick={() => setCollecting(appt)}
                                      >
                                        <Banknote className="size-4" aria-hidden="true" />
                                        <span className="hidden sm:inline">{t("staff.collect")}</span>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{money(appt.price)}</TooltipContent>
                                  </Tooltip>
                                )}
                                {appt.status === "confirmed" && toDateTime(appt.date, appt.start) <= new Date() && (
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    aria-label={t("staff.noShow")}
                                    onClick={() => act.mutate({ fn: markNoShow, id: appt.id, msg: t("status.no_show") })}
                                  >
                                    <UserX className="size-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </motion.div>
            </AnimatePresence>
          )}
        </section>

        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
        {/* Pending queue */}
        <section className="rounded-3xl border bg-card shadow-soft" aria-labelledby="pending-title">
          <div className="flex items-center justify-between border-b p-5">
            <h2 id="pending-title" className="flex items-center gap-2 font-semibold">
              <Hourglass className="size-4 text-warning" aria-hidden="true" />
              {t("staff.pendingTitle")}
            </h2>
            <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-semibold tabular">{num(pendingQ.data?.length ?? 0)}</span>
          </div>
          <div className="max-h-[560px] space-y-2 overflow-y-auto p-3">
            {pendingQ.isLoading ? (
              Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
            ) : pendingQ.data?.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">{t("staff.pendingEmpty")}</p>
            ) : (
              <AnimatePresence initial={false}>
                {pendingQ.data
                  ?.slice()
                  .sort((a, b) => +expiry(a) - +expiry(b))
                  .map((a) => {
                    const p = getPatientSync(a.patientId)
                    const d = getDoctorSync(a.doctorId)!
                    return (
                      <motion.div
                        key={a.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 40 }}
                        transition={{ duration: 0.25 }}
                        className="rounded-2xl border bg-background p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p?.name}</p>
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Stethoscope className="size-3.5" aria-hidden="true" />
                              {tr(d.name)}
                            </p>
                          </div>
                          <Button size="sm" className="h-8 shrink-0 rounded-lg" onClick={() => act.mutate({ fn: confirmAppointment, id: a.id, msg: t("staff.confirmed") })}>
                            {t("staff.confirm")}
                          </Button>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="tabular text-muted-foreground">
                            {fdate(toDateTime(a.date, a.start), "EEE d MMMM")}{sep}{time(a.start)}
                          </span>
                          <a href={`tel:${p?.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline" dir="ltr">
                            <Phone className="size-3.5" aria-hidden="true" />
                            {p?.phone}
                          </a>
                        </div>
                        <p className="mt-2 rounded-lg bg-warning/10 px-2 py-1 text-[11px] text-warning-foreground dark:text-warning">
                          {t("staff.expiresIn", { time: formatDistanceToNowStrict(expiry(a), { addSuffix: true, locale: dateLocale }) })}
                        </p>
                      </motion.div>
                    )
                  })}
              </AnimatePresence>
            )}
          </div>
        </section>
        <FollowUpQueue />
        </div>
      </div>
    </>
  )
}
