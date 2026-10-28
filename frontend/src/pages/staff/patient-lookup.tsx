import { useEffect, useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { Banknote, CalendarPlus, ChevronDown, IdCard, Phone, Search, UserRound, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useLocale } from "@/i18n"
import { ageOf, getDoctorSync, getPatientAppointments, searchPatients, toDateTime } from "@/lib/api"
import type { Appointment, Patient } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Reception: find a patient by name, National ID / Iqama or mobile and see their visits. */
export function PatientLookup({ onCollect }: { onCollect: (a: Appointment) => void }) {
  const { t } = useLocale()
  const [query, setQuery] = useState("")
  const [term, setTerm] = useState("")
  const [openId, setOpenId] = useState<number>()

  // Search once typing pauses
  useEffect(() => {
    const id = setTimeout(() => setTerm(query.trim()), 300)
    return () => clearTimeout(id)
  }, [query])

  const found = useQuery({ queryKey: ["patients", "search", term], queryFn: () => searchPatients(term), enabled: term.length >= 3 })
  const active = term.length >= 3

  return (
    <section className="mb-6 rounded-3xl border bg-card p-4 shadow-soft sm:p-5" aria-label={t("staff.search")}>
      <div className="relative">
        <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpenId(undefined)
          }}
          placeholder={t("staff.search")}
          aria-label={t("staff.search")}
          className="h-12 rounded-2xl ps-12 pe-12 text-base [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={t("common.close")}
            className="absolute end-3 top-1/2 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {query.trim().length > 0 && query.trim().length < 3 && <p className="mt-2 px-1 text-xs text-muted-foreground">{t("staff.searchHint")}</p>}

      {active && (
        <div className="mt-3 space-y-2">
          {found.isLoading ? (
            Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
          ) : found.data?.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">{t("staff.searchEmpty")}</p>
          ) : (
            found.data?.map((p) => (
              <PatientRow
                key={p.id}
                patient={p}
                open={openId === p.id}
                onToggle={() => setOpenId(openId === p.id ? undefined : p.id)}
                onCollect={onCollect}
              />
            ))
          )}
        </div>
      )}
    </section>
  )
}

function PatientRow({
  patient,
  open,
  onToggle,
  onCollect,
}: {
  patient: Patient
  open: boolean
  onToggle: () => void
  onCollect: (a: Appointment) => void
}) {
  const { sep, t, num } = useLocale()
  return (
    <div className={cn("rounded-2xl border bg-background transition-shadow", open && "shadow-soft")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer flex-wrap items-center gap-x-5 gap-y-1 p-3 text-start"
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
            <UserRound className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{patient.name}</span>
            <span className="text-xs text-muted-foreground">
              {t(`patient.${patient.gender}`)}{sep}{t("patient.age", { n: num(ageOf(patient.birthDate)) })}
            </span>
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground tabular" dir="ltr">
          <Phone className="size-3.5" aria-hidden="true" />
          {patient.phone}
        </span>
        {patient.nationalId && (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground tabular" dir="ltr">
            <IdCard className="size-3.5" aria-hidden="true" />
            {patient.nationalId}
          </span>
        )}
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <PatientVisits patient={patient} onCollect={onCollect} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PatientVisits({ patient, onCollect }: { patient: Patient; onCollect: (a: Appointment) => void }) {
  const { sep, t, tr, fdate, time, money } = useLocale()
  const q = useQuery({ queryKey: ["appointments", "patient", patient.id], queryFn: () => getPatientAppointments(patient.id) })
  const now = new Date()
  const list = q.data ?? []
  const upcoming = list.filter((a) => toDateTime(a.date, a.start) >= now && a.status !== "cancelled")
  const past = list.filter((a) => !upcoming.includes(a)).reverse().slice(0, 5)

  const item = (a: Appointment) => (
    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="font-medium tabular">
          {fdate(toDateTime(a.date, a.start), "EEE d MMMM")}{sep}{time(a.start)}
        </span>
        <span className="text-muted-foreground">{sep}{tr(getDoctorSync(a.doctorId)!.name)}</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {money(a.price)}{sep}{t(`payment.${a.paymentStatus === "paid" ? a.paymentMethod : a.paymentStatus}`)}
        </span>
        <StatusBadge status={a.status} />
        {a.paymentStatus === "unpaid" && a.price > 0 && ["pending", "confirmed", "completed"].includes(a.status) && (
          <Button size="sm" variant="outline" className="h-7 rounded-lg" onClick={() => onCollect(a)}>
            <Banknote className="size-3.5" aria-hidden="true" />
            {t("staff.collect")}
          </Button>
        )}
      </span>
    </li>
  )

  return (
    <div className="space-y-4 border-t p-3">
      {q.isLoading ? (
        <Skeleton className="h-20 rounded-xl" />
      ) : (
        <>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">{t("staff.upcoming")}</p>
            {upcoming.length ? <ul className="space-y-1.5">{upcoming.map(item)}</ul> : <p className="text-sm text-muted-foreground">{t("staff.noVisits")}</p>}
          </div>
          {past.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">{t("staff.past")}</p>
              <ul className="space-y-1.5">{past.map(item)}</ul>
            </div>
          )}
        </>
      )}
      <Button asChild size="sm" className="rounded-xl">
        <Link to={`/new?patient=${patient.id}`}>
          <CalendarPlus className="size-4" aria-hidden="true" />
          {t("staff.bookFor")}
        </Link>
      </Button>
    </div>
  )
}
