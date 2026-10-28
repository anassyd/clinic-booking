import { useCallback, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { parse } from "date-fns"
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  Check,
  Clock,
  CreditCard,
  HandCoins,
  LogIn,
  Repeat2,
  Search,
  ShieldCheck,
  Timer,
  Star,
  UserRound,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { DeskPaymentFields, isDeskPaymentValid } from "@/components/shared/desk-payment"
import { DoctorAvatar } from "@/components/shared/doctor-avatar"
import { PulseLoader } from "@/components/shared/pulse-loader"
import { PatientDialog } from "@/components/shared/patient-dialog"
import { SlotPicker, type SlotValue } from "@/components/shared/slot-picker"
import { SpecialtyIcon } from "@/components/shared/specialty-icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useLocale } from "@/i18n"
import {
  ageOf,
  ApiError,
  createAppointment,
  getDoctors,
  getDoctorSync,
  getFollowUps,
  getMyPatients,
  getPatientSync,
  busyPatientsOn,
  getSpecialties,
  getSpecialtySync,
  resendVerification,
  searchPatients,
} from "@/lib/api"
import { errorMessage } from "@/lib/errors"
import type { Appointment, DeskPayment, Patient, PaymentMethod, Role } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAuth } from "@/providers/auth"

import { BookingSuccess } from "./success"
import { Stepper } from "./stepper"

type StepKey = "specialty" | "doctor" | "time" | "patient" | "confirm"
const STEPS: StepKey[] = ["specialty", "doctor", "time", "patient", "confirm"]

function SelectCard({
  selected,
  onClick,
  children,
  className,
  disabled,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={cn(
        disabled && "cursor-not-allowed opacity-60",
        "relative w-full cursor-pointer rounded-2xl border bg-card p-5 text-start transition-[border-color,box-shadow] duration-200",
        selected ? "border-primary shadow-soft ring-2 ring-primary/20" : "hover:border-primary/40 hover:shadow-soft",
        className,
      )}
    >
      {selected && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute end-4 top-4 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          <Check className="size-3.5" aria-hidden="true" />
        </motion.span>
      )}
      {children}
    </motion.button>
  )
}

/* ------------------------------------------------------------------ */

function SpecialtyStep({ value, onPick }: { value?: number; onPick: (id: number) => void }) {
  const { tr } = useLocale()
  const { data, isLoading } = useQuery({ queryKey: ["specialties"], queryFn: getSpecialties })
  if (isLoading) return <GridSkeleton />
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data?.map((s) => (
        <SelectCard key={s.id} selected={value === s.id} onClick={() => onPick(s.id)}>
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <SpecialtyIcon name={s.icon} className="size-6" />
          </span>
          <p className="mt-4 font-semibold">{tr(s.name)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{tr(s.description)}</p>
        </SelectCard>
      ))}
    </div>
  )
}

function DoctorStep({ specialtyId, value, onPick }: { specialtyId: number; value?: number; onPick: (id: number) => void }) {
  const { t, tr, money, num, time } = useLocale()
  const { data, isLoading } = useQuery({ queryKey: ["doctors", specialtyId], queryFn: () => getDoctors(specialtyId) })
  if (isLoading) return <GridSkeleton count={2} />
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data?.map((d) => {
        const shift = d.schedules[0]
        return (
          <SelectCard key={d.id} selected={value === d.id} onClick={() => onPick(d.id)}>
            <div className="flex items-start gap-4 pe-8">
              <DoctorAvatar doctor={d} className="size-16" />
              <div>
                <p className="text-lg font-semibold">{tr(d.name)}</p>
                <p className="text-sm text-muted-foreground">{tr(d.title)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <Star className="size-3.5 fill-warning text-warning" aria-hidden="true" />
                    {num(d.rating)}
                  </span>
                  <span>{t("book.experience", { n: num(d.yearsOfExperience) })}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {time(shift.start)} – {time(shift.end)}
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{tr(d.bio)}</p>
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4 text-sm">
              <span className="rounded-lg bg-muted px-2.5 py-1">
                {t("book.price")}: <b className="tabular">{money(d.consultationPrice)}</b>
              </span>
              <span className="rounded-lg bg-success/10 px-2.5 py-1 text-success">
                {d.followUpPrice === 0 ? t("book.followUpFree") : t("book.followUpPrice", { amount: money(d.followUpPrice) })}
              </span>
            </div>
          </SelectCard>
        )
      })}
    </div>
  )
}

function PatientStep({
  role,
  userId,
  date,
  value,
  onPick,
}: {
  role: Role
  userId: number
  date?: string
  value?: number
  onPick: (p: Patient) => void
}) {
  const { sep, t, num } = useLocale()
  const busy = date ? busyPatientsOn(date) : new Set<number>()
  const [query, setQuery] = useState("")
  const staff = role !== "patient"
  const mine = useQuery({ queryKey: ["patients", "mine", userId], queryFn: getMyPatients, enabled: !staff })
  const found = useQuery({ queryKey: ["patients", "search", query], queryFn: () => searchPatients(query), enabled: staff })
  const list = staff ? found.data : mine.data

  return (
    <div className="space-y-4">
      {staff && (
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("book.searchPatient")}
            aria-label={t("book.searchPatient")}
            className="h-12 rounded-xl ps-10"
          />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list?.map((p) => (
          <SelectCard
            key={p.id}
            selected={value === p.id}
            disabled={busy.has(p.id)}
            onClick={() => onPick(p)}
            className="p-4"
          >
            <div className="flex items-center gap-3 pe-6">
              <span className="grid size-11 place-items-center rounded-full bg-secondary text-secondary-foreground">
                <UserRound className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t(`patient.${p.gender}`)}{sep}{t("patient.age", { n: num(ageOf(p.birthDate)) })}
                </p>
                <p className="text-xs text-muted-foreground tabular" dir="ltr">
                  {p.phone}
                </p>
                {busy.has(p.id) && <p className="mt-1 text-xs font-medium text-destructive">{t("book.patientBusy")}</p>}
              </div>
            </div>
          </SelectCard>
        ))}
        <PatientDialog
          defaults={staff && /^\d+$/.test(query) ? { phone: query } : undefined}
          onCreated={onPick}
        />
      </div>
      {staff && query.length >= 3 && found.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("book.noResults")}</p>
      )}
    </div>
  )
}

function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-40 rounded-2xl" />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */

export default function BookPage() {
  const { sep, t, tr, money, time, fdate, dir, hijri } = useLocale()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const role: Role = user?.role ?? "patient"
  const staff = role !== "patient"
  // Reception and admins take payment at the desk; doctors only book
  const desk = role === "receptionist" || role === "admin"

  // Doctors can only book into their own schedule
  const lockedDoctor = role === "doctor" ? getDoctorSync(user!.doctorId!) : undefined
  const specialtyId = lockedDoctor?.specialtyId ?? (Number(params.get("specialty")) || undefined)
  const doctorId = lockedDoctor?.id ?? (Number(params.get("doctor")) || undefined)
  const date = params.get("date") ?? undefined
  const start = params.get("start") ?? undefined
  const patientId = Number(params.get("patient")) || undefined
  // Booking a follow-up the doctor asked for: doctor and patient are fixed, only the time is picked
  const followUpOf = Number(params.get("followUp")) || undefined
  const followUps = useQuery({ queryKey: ["follow-ups"], queryFn: getFollowUps, enabled: !!followUpOf && !!user })
  const request = followUps.data?.find((a) => a.id === followUpOf)

  const firstStep = followUpOf || lockedDoctor ? 2 : 0
  const inferred = !specialtyId ? 0 : !doctorId ? 1 : !start ? 2 : !patientId ? 3 : 4
  const [step, setStep] = useState(Math.max(firstStep, Math.min(inferred, Number(params.get("step") ?? inferred))))
  const [direction, setDirection] = useState(1)
  const [payment, setPayment] = useState<PaymentMethod>("online")
  const [payNow, setPayNow] = useState(true)
  const [deskPayment, setDeskPayment] = useState<DeskPayment>({ method: "cash" })
  const [triedDesk, setTriedDesk] = useState(false)
  const [notes, setNotes] = useState("")
  const [paying, setPaying] = useState(false)
  const [done, setDone] = useState<Appointment | null>(null)
  const [patient, setPatient] = useState<Patient | undefined>()

  const update = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined) next.delete(k)
            else next.set(k, String(v))
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const go = (target: number) => {
    // The patient step is skipped for a follow-up: it belongs to the visit's patient
    const to = followUpOf && target === 3 ? (target > step ? 4 : 2) : target
    setDirection(to > step ? 1 : -1)
    setStep(to)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const doctor = doctorId ? getDoctorSync(doctorId) : undefined
  const specialty = specialtyId ? getSpecialtySync(specialtyId) : undefined
  const price = doctor ? (followUpOf ? doctor.followUpPrice : doctor.consultationPrice) : 0

  const mutation = useMutation({
    mutationFn: async () => {
      const { appointment, paymentUrl } = await createAppointment({
        doctorId: doctorId!,
        date: date!,
        start: start!,
        patientId: patientId!,
        paymentMethod: staff ? "cash" : payment,
        payment: desk && payNow && price > 0 ? deskPayment : undefined,
        followUpOf,
        notes,
      })
      return { appointment, paymentUrl }
    },
    onSuccess: ({ appointment, paymentUrl }) => {
      qc.invalidateQueries()
      // Online: hand over to the gateway's hosted page; it redirects back to /my?payment=…
      if (paymentUrl) {
        setPaying(true)
        window.location.assign(paymentUrl)
        return
      }
      setDone(appointment)
    },
    onError: (e) => {
      setPaying(false)
      if (e instanceof ApiError && e.code === "email_unverified") {
        toast.error(errorMessage(t, e), {
          action: { label: t("auth.resend"), onClick: () => resendVerification().then(() => toast.success(t("auth.resent"))) },
        })
        return
      }
      toast.error(errorMessage(t, e))
      qc.invalidateQueries({ queryKey: ["slots"] })
      qc.invalidateQueries({ queryKey: ["availability"] })
    },
  })

  const canNext = [!!specialtyId, !!doctorId, !!start, !!patientId, true][step]
  const Back = dir === "rtl" ? ArrowRight : ArrowLeft
  const Next = dir === "rtl" ? ArrowLeft : ArrowRight

  const slotValue = useMemo<SlotValue>(() => ({ date, start }), [date, start])
  const onSlotChange = useCallback((v: SlotValue) => update({ date: v.date, start: v.start }), [update])

  if (done) {
    return (
      <BookingSuccess
        appointment={done}
        onAgain={() => {
          setDone(null)
          setParams({}, { replace: true })
          setStep(lockedDoctor ? 2 : 0)
        }}
      />
    )
  }

  const stepTitles: Record<StepKey, string> = {
    specialty: t("book.chooseSpecialty"),
    doctor: t("book.chooseDoctor"),
    time: t("book.chooseSlot"),
    patient: t("book.choosePatient"),
    confirm: t("book.review"),
  }

  return (
    <div className={cn(!user && "mx-auto max-w-5xl px-4 py-10 sm:px-6")}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {followUpOf ? t("followUp.bookingTitle") : staff ? t("staff.quickBook") : t("book.title")}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("book.subtitle")}</p>
        {request?.followUpDue && doctor && (
          <p className="mt-4 flex items-start gap-2 rounded-2xl bg-primary/8 p-4 text-sm">
            <Repeat2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              {t("followUp.bookingHint", {
                doctor: tr(doctor.name),
                patient: request.patient?.name ?? getPatientSync(request.patientId)?.name ?? "",
                date: fdate(parse(request.followUpDue, "yyyy-MM-dd", new Date()), "EEEE d MMMM"),
              })}
              {request.followUpNote && <span className="block text-muted-foreground">{request.followUpNote}</span>}
            </span>
          </p>
        )}
      </div>

      <Stepper steps={STEPS.map((s) => t(`book.steps.${s}`))} current={step} onSelect={(i) => i >= firstStep && !(followUpOf && i === 3) && go(i)} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="min-w-0 rounded-3xl border bg-card/60 p-4 shadow-soft sm:p-6" aria-labelledby="step-title">
          <h2 id="step-title" className="mb-5 text-lg font-semibold">
            {stepTitles[STEPS[step]]}
          </h2>

          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={step}
              custom={direction}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: (dir === "rtl" ? -1 : 1) * d * 32 }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: (dir === "rtl" ? 1 : -1) * d * 32 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {step === 0 && (
                <SpecialtyStep
                  value={specialtyId}
                  onPick={(id) => {
                    update({ specialty: id, doctor: undefined, date: undefined, start: undefined })
                    go(1)
                  }}
                />
              )}
              {step === 1 && specialtyId && (
                <DoctorStep
                  specialtyId={specialtyId}
                  value={doctorId}
                  onPick={(id) => {
                    update({ doctor: id, date: undefined, start: undefined })
                    go(2)
                  }}
                />
              )}
              {step === 2 && doctorId && (
                <SlotPicker doctorId={doctorId} role={role} value={slotValue} onChange={onSlotChange} />
              )}
              {step === 3 &&
                (user ? (
                  <PatientStep
                    role={role}
                    userId={user.id}
                    date={date}
                    value={patientId}
                    onPick={(p) => {
                      setPatient(p)
                      update({ patient: p.id })
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed p-10 text-center">
                    <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <LogIn className="size-6" aria-hidden="true" />
                    </span>
                    <p className="font-semibold">{t("book.loginRequired")}</p>
                    <div className="flex gap-2">
                      <Button onClick={() => navigate("/login", { state: { from: `/new?${params.toString()}&step=3` } })}>
                        {t("nav.login")}
                      </Button>
                      <Button variant="outline" asChild>
                        <Link to="/register" state={{ from: `/new?${params.toString()}&step=3` }}>
                          {t("nav.register")}
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              {step === 4 && (
                <div className="space-y-6">
                  {desk && price > 0 && (
                    <fieldset>
                      <legend className="mb-3 font-semibold">{t("book.payment")}</legend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(
                          [
                            { now: true, icon: HandCoins, title: t("book.payNow"), hint: t("book.payNowHint") },
                            { now: false, icon: Timer, title: t("book.payLater"), hint: t("book.payLaterHint") },
                          ] as const
                        ).map((m) => (
                          <SelectCard key={m.title} selected={payNow === m.now} onClick={() => setPayNow(m.now)} className="p-4">
                            <div className="flex items-center gap-3 pe-6">
                              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                                <m.icon className="size-5" aria-hidden="true" />
                              </span>
                              <div>
                                <p className="font-semibold">{m.title}</p>
                                <p className="text-xs text-muted-foreground">{m.hint}</p>
                              </div>
                            </div>
                          </SelectCard>
                        ))}
                      </div>
                      <AnimatePresence initial={false}>
                        {payNow && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-4">
                              <DeskPaymentFields value={deskPayment} onChange={setDeskPayment} showErrors={triedDesk} />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </fieldset>
                  )}
                  {!staff && price > 0 && (
                    <fieldset>
                      <legend className="mb-3 font-semibold">{t("book.payment")}</legend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(
                          [
                            { key: "online", icon: CreditCard, title: t("book.online"), hint: t("book.onlineHint") },
                            { key: "cash", icon: Banknote, title: t("book.cash"), hint: t("book.cashHint") },
                          ] as const
                        ).map((m) => (
                          <SelectCard key={m.key} selected={payment === m.key} onClick={() => setPayment(m.key)} className="p-4">
                            <div className="flex items-center gap-3 pe-6">
                              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                                <m.icon className="size-5" aria-hidden="true" />
                              </span>
                              <div>
                                <p className="font-semibold">{m.title}</p>
                                <p className="text-xs text-muted-foreground">{m.hint}</p>
                              </div>
                            </div>
                          </SelectCard>
                        ))}
                      </div>
                      {payment === "online" && (
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ShieldCheck className="size-4 text-success" aria-hidden="true" />
                          {t("book.holdNote")}
                        </p>
                      )}
                    </fieldset>
                  )}
                  <div>
                    <label htmlFor="notes" className="mb-2 block font-semibold">
                      {t("book.notes")}
                    </label>
                    <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-24 rounded-xl" />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5">
            <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === firstStep} className="rounded-xl">
              <Back className="size-4" />
              {t("book.back")}
            </Button>
            {step < 4 ? (
              <Button onClick={() => go(step + 1)} disabled={!canNext || (step === 3 && !user)} className="h-11 rounded-xl px-6">
                {t("book.next")}
                <Next className="size-4" />
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setTriedDesk(true)
                  if (desk && payNow && !isDeskPaymentValid(deskPayment)) return
                  mutation.mutate()
                }}
                disabled={mutation.isPending}
                className="h-11 rounded-xl px-6 shadow-soft"
              >
                {mutation.isPending && <Spinner />}
                {!staff && payment === "online" && price > 0
                  ? t("book.payCta", { amount: money(price) })
                  : t("book.confirmCta")}
              </Button>
            )}
          </div>
        </section>

        {/* Live summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border bg-card p-5 shadow-soft">
            <p className="mb-4 text-sm font-semibold text-muted-foreground">{t("book.summary")}</p>
            <ul className="space-y-4 text-sm">
              <SummaryRow icon={<SpecialtyIcon name={specialty?.icon ?? "stethoscope"} className="size-4" />} label={t("book.steps.specialty")}>
                {specialty ? tr(specialty.name) : "—"}
              </SummaryRow>
              <SummaryRow icon={<UserRound className="size-4" />} label={t("book.steps.doctor")}>
                {doctor ? tr(doctor.name) : "—"}
              </SummaryRow>
              <SummaryRow icon={<CalendarDays className="size-4" />} label={t("book.steps.time")}>
                {date && start
                  ? `${fdate(parse(date, "yyyy-MM-dd", new Date()), "EEEE d MMMM")} (${hijri(parse(date, "yyyy-MM-dd", new Date()))})${sep}${time(start)}`
                  : "—"}
              </SummaryRow>
              <SummaryRow icon={<UserRound className="size-4" />} label={t("book.steps.patient")}>
                {(patient ?? (patientId ? getPatientSync(patientId) : undefined))?.name ?? "—"}
              </SummaryRow>
            </ul>
            {doctor && (
              <div className="mt-5 flex items-center justify-between border-t pt-4">
                <span className="text-sm text-muted-foreground">{t("book.total")}</span>
                <span className="text-lg font-bold tabular">{price === 0 ? t("followUp.free") : money(price)}</span>
              </div>
            )}
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {paying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm"
            role="status"
            aria-live="polite"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="flex flex-col items-center gap-4 rounded-3xl border bg-card px-10 py-8 shadow-lift"
            >
              <PulseLoader label={t("book.paying")} className="[&_p]:text-base [&_p]:text-foreground" />
              <p className="text-xs text-muted-foreground">Moyasar</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SummaryRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={String(children)}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="font-medium"
          >
            {children}
          </motion.p>
        </AnimatePresence>
      </div>
    </li>
  )
}
