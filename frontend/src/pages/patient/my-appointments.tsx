import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format, parse } from "date-fns"
import { CalendarClock, CalendarDays, CalendarPlus, Clock, CreditCard, Lock, Repeat2, XCircle } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { DoctorAvatar } from "@/components/shared/doctor-avatar"
import { PageHeader } from "@/components/shared/page-header"
import { SlotPicker, type SlotValue } from "@/components/shared/slot-picker"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLocale } from "@/i18n"
import {
  canPatientModify,
  cancelAppointment,
  followUpBookingPath,
  getDoctorSync,
  getFollowUps,
  getMyAppointments,
  getPatientSync,
  getSpecialtySync,
  payAppointment,
  rescheduleAppointment,
  toDateTime,
} from "@/lib/api"
import { errorMessage } from "@/lib/errors"
import type { Appointment } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAuth } from "@/providers/auth"

function AppointmentCard({
  appt,
  onCancel,
  onReschedule,
}: {
  appt: Appointment
  onCancel: () => void
  onReschedule: () => void
}) {
  const { sep, t, tr, time, money, fdate, num, hijri } = useLocale()
  const doctor = getDoctorSync(appt.doctorId)!
  const specialty = getSpecialtySync(doctor.specialtyId)!
  const patient = getPatientSync(appt.patientId)
  const date = parse(appt.date, "yyyy-MM-dd", new Date())
  const modifiable = canPatientModify(appt)
  const active = ["held", "pending", "confirmed"].includes(appt.status)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn("overflow-hidden rounded-3xl border bg-card shadow-soft", appt.status === "cancelled" && "opacity-75")}
    >
      <div className="flex flex-col sm:flex-row">
        <div className="flex items-center gap-4 border-b bg-muted/40 px-5 py-4 sm:w-36 sm:flex-col sm:justify-center sm:border-e sm:border-b-0 sm:text-center">
          <p className="text-xs font-medium text-muted-foreground uppercase">{fdate(date, "EEEE")}</p>
          <p className="tabular text-4xl leading-none font-extrabold text-primary">{num(date.getDate())}</p>
          <p className="text-sm text-muted-foreground">{fdate(date, "MMMM yyyy")}</p>
          <p className="text-xs text-muted-foreground/80">{hijri(date)}</p>
        </div>
        <div className="flex-1 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <DoctorAvatar doctor={doctor} className="size-12 rounded-xl text-base" />
              <div>
                <p className="font-semibold">{tr(doctor.name)}</p>
                <p className="text-sm text-muted-foreground">{tr(specialty.name)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {appt.type === "follow_up" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                  <Repeat2 className="size-3.5" aria-hidden="true" />
                  {t("type.follow_up")}
                </span>
              )}
              <StatusBadge status={appt.status} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden="true" />
              {time(appt.start)} – {time(appt.end)}
            </span>
            <span>{patient?.name}</span>
            <span className="tabular">
              {money(appt.price)}{sep}{t(`payment.${appt.paymentMethod}`)}{sep}{t(`payment.${appt.paymentStatus}`)}
            </span>
          </div>
          {active && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4">
              {appt.status === "held" && <PayNowButton id={appt.id} />}
              {modifiable ? (
                <>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={onReschedule}>
                    <CalendarClock className="size-4" aria-hidden="true" />
                    {t("my.reschedule")}
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onCancel}>
                    <XCircle className="size-4" aria-hidden="true" />
                    {t("my.cancel")}
                  </Button>
                </>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" tabIndex={0}>
                      <Lock className="size-3.5" aria-hidden="true" />
                      {t("my.locked")}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t("errors.cutoff_passed")}</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.article>
  )
}

/** The slot is still held (15 min) — open a fresh checkout for it. */
function PayNowButton({ id }: { id: number }) {
  const { t } = useLocale()
  const pay = useMutation({
    mutationFn: () => payAppointment(id),
    onSuccess: (url) => window.location.assign(url),
    onError: (e) => toast.error(errorMessage(t, e)),
  })
  return (
    <Button size="sm" className="rounded-lg" onClick={() => pay.mutate()} disabled={pay.isPending}>
      {pay.isPending ? <Spinner /> : <CreditCard className="size-4" aria-hidden="true" />}
      {t("my.payNow")}
    </Button>
  )
}

export default function MyAppointmentsPage() {
  const { sep, t, tr, fdate, time, hijri } = useLocale()
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ["appointments", "mine", user!.id], queryFn: getMyAppointments })
  const followUps = useQuery({ queryKey: ["follow-ups"], queryFn: getFollowUps })
  const [cancelling, setCancelling] = useState<Appointment | null>(null)
  const [reason, setReason] = useState("")
  const [moving, setMoving] = useState<Appointment | null>(null)
  const [slot, setSlot] = useState<SlotValue>({})
  const [params, setParams] = useSearchParams()

  // Back from the payment gateway: ?payment=<id>. The webhook is the source of truth, so report what the server says.
  const returnedFrom = params.get("payment")
  useEffect(() => {
    if (!returnedFrom || !data) return
    const held = data.some((a) => a.status === "held")
    if (held) toast.info(t("my.paymentPending"))
    else toast.success(t("my.paid"))
    setParams({}, { replace: true })
  }, [returnedFrom, data, setParams, t])

  const today = format(new Date(), "yyyy-MM-dd")
  const upcoming = (data ?? [])
    .filter((a) => a.date >= today && ["held", "pending", "confirmed"].includes(a.status))
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
  const past = (data ?? []).filter((a) => !upcoming.includes(a))

  const cancel = useMutation({
    mutationFn: () => cancelAppointment(cancelling!.id, reason),
    onSuccess: () => {
      toast.success(t("my.cancelled"))
      setCancelling(null)
      setReason("")
      qc.invalidateQueries()
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  })

  const reschedule = useMutation({
    mutationFn: () => rescheduleAppointment(moving!.id, slot.date!, slot.start!),
    onSuccess: () => {
      toast.success(t("my.rescheduled"))
      setMoving(null)
      setSlot({})
      qc.invalidateQueries()
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  })

  const list = (items: Appointment[]) =>
    isLoading ? (
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-3xl" />
        ))}
      </div>
    ) : items.length === 0 ? (
      <Empty className="rounded-3xl border border-dashed bg-card py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarDays />
          </EmptyMedia>
          <EmptyTitle>{t("my.empty")}</EmptyTitle>
          <EmptyDescription>{t("my.subtitle")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to="/new">{t("my.emptyCta")}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    ) : (
      <motion.div layout className="space-y-4">
        <AnimatePresence initial={false}>
          {items.map((a) => (
            <AppointmentCard key={a.id} appt={a} onCancel={() => setCancelling(a)} onReschedule={() => setMoving(a)} />
          ))}
        </AnimatePresence>
      </motion.div>
    )

  return (
    <>
      <PageHeader
        title={t("my.title")}
        subtitle={t("my.subtitle")}
        actions={
          <Button asChild className="rounded-xl shadow-soft">
            <Link to="/new">
              <CalendarPlus className="size-4" aria-hidden="true" />
              {t("nav.book")}
            </Link>
          </Button>
        }
      />
      {/* Follow-ups the doctor asked for: the patient books them like any visit */}
      {followUps.data && followUps.data.length > 0 && (
        <div className="mb-6 space-y-3">
          {followUps.data.map((f) => {
            const doctor = getDoctorSync(f.doctorId)
            const due = parse(f.followUpDue!, "yyyy-MM-dd", new Date())
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-4 rounded-3xl border border-primary/25 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
                    <Repeat2 className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">{t("followUp.myTitle")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("followUp.myHint", {
                        doctor: doctor ? tr(doctor.name) : "",
                        patient: getPatientSync(f.patientId)?.name ?? "",
                        date: `${fdate(due, "EEEE d MMMM")} (${hijri(due)})`,
                      })}
                    </p>
                    {f.followUpNote && <p className="mt-1 text-sm">{f.followUpNote}</p>}
                  </div>
                </div>
                <Button asChild className="shrink-0 rounded-xl shadow-soft">
                  <Link to={followUpBookingPath(f)}>
                    <CalendarPlus className="size-4" aria-hidden="true" />
                    {t("followUp.bookNow")}
                  </Link>
                </Button>
              </motion.div>
            )
          })}
        </div>
      )}
      <Tabs defaultValue="upcoming">
        <TabsList className="mb-5">
          <TabsTrigger value="upcoming">
            {t("my.upcoming")} <span className="ms-1 rounded-full bg-primary/10 px-1.5 text-xs text-primary">{upcoming.length}</span>
          </TabsTrigger>
          <TabsTrigger value="past">{t("my.past")}</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">{list(upcoming)}</TabsContent>
        <TabsContent value="past">{list(past)}</TabsContent>
      </Tabs>

      <AlertDialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("my.cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("my.cancelBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <label htmlFor="reason" className="text-sm font-medium">
            {t("my.reason")}
          </label>
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl" />
          <AlertDialogFooter>
            <AlertDialogCancel>{t("my.keep")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                cancel.mutate()
              }}
              disabled={cancel.isPending}
            >
              {cancel.isPending && <Spinner />}
              {t("my.cancelConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!moving} onOpenChange={(o) => !o && (setMoving(null), setSlot({}))}>
        {/* Fixed header and footer; only the picker scrolls, so the confirm button and the chosen slot stay in view */}
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b px-6 pt-6 pb-4 text-start">
            <DialogTitle>{t("my.reschedule")}</DialogTitle>
            <DialogDescription>
              {moving && (
                <>
                  {t("my.currentSlot")}: <span className="font-medium text-foreground">{fdate(toDateTime(moving.date, moving.start), "EEEE d MMMM")}{sep}{time(moving.start)}</span>
                  <br />
                </>
              )}
              {t("book.leadTimeNote")}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-5">
            {moving && <SlotPicker compact doctorId={moving.doctorId} role="patient" value={slot} onChange={setSlot} ignoreId={moving.id} />}
          </div>
          <DialogFooter className="items-center gap-3 border-t bg-muted/30 px-6 py-4 sm:justify-between">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {slot.date && slot.start ? (
                <>
                  {t("my.newSlot")}: <span className="font-semibold text-foreground">{fdate(toDateTime(slot.date, slot.start), "EEEE d MMMM")}{sep}{time(slot.start)}</span>
                </>
              ) : (
                t("my.pickNew")
              )}
            </p>
            <Button onClick={() => reschedule.mutate()} disabled={!slot.start || reschedule.isPending} className="h-10 rounded-xl px-6">
              {reschedule.isPending && <Spinner />}
              {t("my.confirmReschedule")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
