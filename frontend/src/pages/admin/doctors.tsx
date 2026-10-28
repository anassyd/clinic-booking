import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router"
import { parse } from "date-fns"
import { AlertTriangle, CalendarClock, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"

import { DoctorAvatar } from "@/components/shared/doctor-avatar"
import { PageHeader } from "@/components/shared/page-header"
import { SpecialtyIcon } from "@/components/shared/specialty-icon"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLocale } from "@/i18n"
import { adminDoctors, adminSpecialties, adminStaff, saveDoctor, saveSchedule, type AdminDoctor, type DoctorInput } from "@/lib/admin-api"
import { errorMessage } from "@/lib/errors"
import type { Appointment } from "@/lib/types"
import { cn } from "@/lib/utils"

import { ActiveBadge, errorFor, Panel, SelectField, serverErrors, TextField, type ServerErrors } from "./ui"

/** Saturday → Friday, matching the clinic week. Carbon/date-fns dayOfWeek values. */
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5]

const emptyDoctor = (specialtyId: number): DoctorInput => ({
  specialty_id: specialtyId,
  user_id: null,
  name: { ar: "", en: "" },
  title: { ar: "", en: "" },
  bio: { ar: "", en: "" },
  years_of_experience: 0,
  consultation_price: 250,
  follow_up_price: 0,
  is_active: true,
})

const toInput = (d: AdminDoctor): DoctorInput => ({
  specialty_id: d.specialtyId,
  user_id: d.userId ?? null,
  name: d.name,
  title: d.title ?? { ar: "", en: "" },
  bio: d.bio ?? { ar: "", en: "" },
  years_of_experience: d.yearsOfExperience,
  consultation_price: d.consultationPrice,
  follow_up_price: d.followUpPrice,
  is_active: d.isActive,
})

function DoctorDialog({ doctor, specialtyId, open, onClose }: { doctor?: AdminDoctor; specialtyId?: number; open: boolean; onClose: () => void }) {
  const { t, tr } = useLocale()
  const qc = useQueryClient()
  const specialties = useQuery({ queryKey: ["admin", "specialties"], queryFn: adminSpecialties })
  const staff = useQuery({ queryKey: ["admin", "staff"], queryFn: adminStaff })
  const doctors = useQuery({ queryKey: ["admin", "doctors"], queryFn: adminDoctors })
  const [form, setForm] = useState<DoctorInput>(() => (doctor ? toInput(doctor) : emptyDoctor(specialtyId ?? 1)))
  const [errors, setErrors] = useState<ServerErrors>()

  const set = <K extends keyof DoctorInput>(key: K, value: DoctorInput[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setT = (key: "name" | "title" | "bio", lang: "ar" | "en", value: string) =>
    setForm((f) => ({ ...f, [key]: { ...(f[key] ?? { ar: "", en: "" }), [lang]: value } }))

  // Doctor-role accounts not already linked to another profile
  const linked = new Set(doctors.data?.filter((d) => d.id !== doctor?.id).map((d) => d.userId))
  const accounts = staff.data?.filter((u) => u.role === "doctor" && !linked.has(u.id)) ?? []

  const save = useMutation({
    mutationFn: () => saveDoctor(form, doctor?.id),
    onSuccess: () => {
      toast.success(t("admin.common.saved"))
      qc.invalidateQueries({ queryKey: ["admin", "doctors"] })
      onClose()
    },
    onError: (e) => {
      setErrors(serverErrors(e))
      toast.error(errorMessage(t, e))
    },
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{doctor ? t("admin.doctors.edit") : t("admin.doctors.add")}</DialogTitle>
          {doctor && <DialogDescription>{tr(doctor.name)}</DialogDescription>}
        </DialogHeader>
        <form
          id="doctor-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          <TextField id="d-name-ar" dir="rtl" label={t("admin.common.nameAr")} value={form.name.ar} onChange={(e) => setT("name", "ar", e.target.value)} error={errorFor(errors, "name.ar")} required />
          <TextField id="d-name-en" dir="ltr" label={t("admin.common.nameEn")} value={form.name.en} onChange={(e) => setT("name", "en", e.target.value)} error={errorFor(errors, "name.en")} required />
          <TextField id="d-title-ar" dir="rtl" label={t("admin.doctors.titleAr")} value={form.title?.ar ?? ""} onChange={(e) => setT("title", "ar", e.target.value)} />
          <TextField id="d-title-en" dir="ltr" label={t("admin.doctors.titleEn")} value={form.title?.en ?? ""} onChange={(e) => setT("title", "en", e.target.value)} />
          <SelectField id="d-specialty" label={t("admin.doctors.specialty")} value={form.specialty_id} onChange={(e) => set("specialty_id", Number(e.target.value))} error={errorFor(errors, "specialty_id")}>
            {specialties.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {tr(s.name)}
              </option>
            ))}
          </SelectField>
          <SelectField id="d-account" label={t("admin.doctors.account")} value={form.user_id ?? ""} onChange={(e) => set("user_id", e.target.value ? Number(e.target.value) : null)} error={errorFor(errors, "user_id")}>
            <option value="">{t("admin.doctors.noAccount")}</option>
            {accounts.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.email}
              </option>
            ))}
          </SelectField>
          <TextField id="d-price" type="number" min={0} inputMode="numeric" label={t("admin.doctors.price")} value={form.consultation_price} onChange={(e) => set("consultation_price", Number(e.target.value))} error={errorFor(errors, "consultation_price")} />
          <TextField id="d-followup" type="number" min={0} inputMode="numeric" label={t("admin.doctors.followUp")} hint={t("admin.doctors.followUpHint")} value={form.follow_up_price} onChange={(e) => set("follow_up_price", Number(e.target.value))} error={errorFor(errors, "follow_up_price")} />
          <TextField id="d-years" type="number" min={0} inputMode="numeric" label={t("admin.doctors.years")} value={form.years_of_experience} onChange={(e) => set("years_of_experience", Number(e.target.value))} />
          <label className="flex cursor-pointer items-center justify-between gap-3 self-end rounded-xl border px-4 py-2.5 text-sm font-medium">
            {t("admin.common.active")}
            <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
          </label>
          <TextField id="d-bio-ar" multiline dir="rtl" label={t("admin.doctors.bioAr")} value={form.bio?.ar ?? ""} onChange={(e) => setT("bio", "ar", e.target.value)} />
          <TextField id="d-bio-en" multiline dir="ltr" label={t("admin.doctors.bioEn")} value={form.bio?.en ?? ""} onChange={(e) => setT("bio", "en", e.target.value)} />
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("admin.common.cancel")}
          </Button>
          <Button type="submit" form="doctor-form" disabled={save.isPending} className="rounded-xl">
            {save.isPending && <Spinner />}
            {t("admin.common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type DayRow = { on: boolean; start: string; end: string }

function ScheduleDialog({ doctor, onClose }: { doctor: AdminDoctor; onClose: () => void }) {
  const { sep, t, tr, fdate, time } = useLocale()
  const qc = useQueryClient()
  const [days, setDays] = useState<Record<number, DayRow>>(() =>
    Object.fromEntries(
      WEEK_ORDER.map((d) => {
        const s = doctor.schedules.find((x) => x.dayOfWeek === d)
        return [d, s ? { on: true, start: s.start, end: s.end } : { on: false, start: "09:00", end: "17:00" }]
      }),
    ),
  )
  const [outside, setOutside] = useState<Appointment[] | null>(null)
  const [errors, setErrors] = useState<ServerErrors>()
  // date-fns: 2026-10-24 is a Saturday, so +n days gives each weekday's name
  const dayName = (dow: number) => fdate(new Date(2026, 9, 24 + ((dow - 6 + 7) % 7)), "EEEE")

  const save = useMutation({
    mutationFn: () =>
      saveSchedule(
        doctor.id,
        WEEK_ORDER.filter((d) => days[d].on).map((d) => ({ day_of_week: d, start: days[d].start, end: days[d].end })),
      ),
    onSuccess: (res) => {
      toast.success(t("admin.common.saved"))
      qc.invalidateQueries({ queryKey: ["admin", "doctors"] })
      if (res.outsideSchedule.length) setOutside(res.outsideSchedule)
      else onClose()
    },
    onError: (e) => {
      setErrors(serverErrors(e))
      toast.error(errorMessage(t, e))
    },
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("admin.doctors.scheduleTitle", { name: tr(doctor.name) })}</DialogTitle>
          <DialogDescription>{t("admin.doctors.scheduleHint")}</DialogDescription>
        </DialogHeader>

        {outside ? (
          <div className="space-y-3">
            <p className="flex items-start gap-2 rounded-xl bg-warning/15 p-3 text-sm font-medium text-warning-foreground dark:text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t("admin.doctors.outside", { n: outside.length })}
            </p>
            <ul className="max-h-64 divide-y overflow-y-auto rounded-xl border text-sm">
              {outside.map((a) => (
                <li key={a.id} className="flex justify-between gap-3 px-3 py-2">
                  <span>{a.patient?.name}</span>
                  <span className="text-muted-foreground tabular">
                    {fdate(parse(a.date, "yyyy-MM-dd", new Date()), "EEEE d MMMM")}{sep}{time(a.start)}
                  </span>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button onClick={onClose}>{t("common.close")}</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="divide-y rounded-2xl border">
              {WEEK_ORDER.map((d) => {
                const row = days[d]
                const update = (patch: Partial<DayRow>) => setDays((all) => ({ ...all, [d]: { ...all[d], ...patch } }))
                return (
                  <div key={d} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <label className="flex w-32 cursor-pointer items-center gap-3 text-sm font-medium">
                      <Switch checked={row.on} onCheckedChange={(on) => update({ on })} aria-label={dayName(d)} />
                      {dayName(d)}
                    </label>
                    {row.on ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{t("admin.doctors.from")}</span>
                        <input type="time" step={1800} value={row.start} onChange={(e) => update({ start: e.target.value })} className="h-9 rounded-lg border bg-transparent px-2 tabular" dir="ltr" aria-label={`${dayName(d)} ${t("admin.doctors.from")}`} />
                        <span className="text-muted-foreground">{t("admin.doctors.to")}</span>
                        <input type="time" step={1800} value={row.end} onChange={(e) => update({ end: e.target.value })} className="h-9 rounded-lg border bg-transparent px-2 tabular" dir="ltr" aria-label={`${dayName(d)} ${t("admin.doctors.to")}`} />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">{t("admin.doctors.off")}</span>
                    )}
                  </div>
                )
              })}
            </div>
            {errors && <p className="text-sm text-destructive">{Object.values(errors)[0]?.[0]}</p>}
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                {t("admin.common.cancel")}
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending} className="rounded-xl">
                {save.isPending && <Spinner />}
                {t("admin.common.save")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function AdminDoctorsPage() {
  const { sep, t, tr, money, num, time } = useLocale()
  const q = useQuery({ queryKey: ["admin", "doctors"], queryFn: adminDoctors })
  const specialties = useQuery({ queryKey: ["admin", "specialties"], queryFn: adminSpecialties })
  const [editing, setEditing] = useState<AdminDoctor | "new" | null>(null)
  const [scheduling, setScheduling] = useState<AdminDoctor | null>(null)
  // The chosen specialty lives in the URL, so a refresh or the back button keeps it
  const [params, setParams] = useSearchParams()
  const specialtyId = Number(params.get("specialty")) || undefined
  const pick = (id?: number) => setParams(id ? { specialty: String(id) } : {}, { replace: true })
  const rows = specialtyId ? q.data?.filter((d) => d.specialtyId === specialtyId) : q.data
  const countFor = (id: number) => q.data?.filter((d) => d.specialtyId === id).length ?? 0

  return (
    <>
      <PageHeader
        title={t("admin.doctors.title")}
        subtitle={t("admin.doctors.subtitle")}
        actions={
          <Button className="rounded-xl shadow-soft" onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden="true" />
            {t("admin.doctors.add")}
          </Button>
        }
      />
      {/* Padding inside the scroller (offset by the negative margin) keeps the chip rings and shadow from being clipped */}
      <div role="tablist" aria-label={t("admin.doctors.specialty")} className="-m-1.5 mb-2.5 flex gap-2 overflow-x-auto p-1.5">
        {[{ id: undefined, name: null, icon: "layers", count: q.data?.length ?? 0 }, ...(specialties.data ?? []).map((s) => ({ id: s.id as number | undefined, name: s.name, icon: s.icon, count: countFor(s.id) }))].map((s) => {
          const selected = s.id === specialtyId
          return (
            <button
              key={s.id ?? "all"}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => pick(s.id)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
                selected ? "bg-primary text-primary-foreground shadow-soft" : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground",
              )}
            >
              {s.id && <SpecialtyIcon name={s.icon} className="size-4" />}
              {s.name ? tr(s.name) : t("admin.doctors.allSpecialties")}
              <span className={cn("rounded-full px-1.5 text-xs tabular", selected ? "bg-primary-foreground/20" : "bg-muted")}>{num(s.count)}</span>
            </button>
          )
        })}
      </div>
      <Panel className="overflow-hidden">
        {q.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-5">{t("admin.reports.table.doctor")}</TableHead>
                {!specialtyId && <TableHead>{t("admin.doctors.specialty")}</TableHead>}
                <TableHead>{t("admin.doctors.schedule")}</TableHead>
                <TableHead className="text-end">{t("book.price")}</TableHead>
                <TableHead />
                <TableHead className="pe-5 text-end">{t("admin.common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows?.map((d) => {
                const s = d.schedules[0]
                return (
                  <TableRow key={d.id} className={cn(!d.isActive && "opacity-60")}>
                    <TableCell className="ps-5">
                      <div className="flex items-center gap-3">
                        <DoctorAvatar doctor={d} className="size-10 rounded-xl text-sm" />
                        <div>
                          <p className="font-medium">{tr(d.name)}</p>
                          <p className="text-xs text-muted-foreground">{tr(d.title)}</p>
                        </div>
                      </div>
                    </TableCell>
                    {!specialtyId && <TableCell>{tr(d.specialty?.name)}</TableCell>}
                    <TableCell className="text-sm text-muted-foreground tabular">
                      {s ? `${time(s.start)} – ${time(s.end)}${sep}${t("admin.doctors.workingDays", { n: num(d.schedules.length) })}` : t("admin.doctors.off")}
                    </TableCell>
                    <TableCell className="text-end tabular">{money(d.consultationPrice)}</TableCell>
                    <TableCell>
                      <ActiveBadge active={d.isActive} />
                    </TableCell>
                    <TableCell className="pe-5">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setScheduling(d)}>
                          <CalendarClock className="size-4" aria-hidden="true" />
                          <span className="hidden md:inline">{t("admin.doctors.schedule")}</span>
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={t("admin.common.edit")} onClick={() => setEditing(d)}>
                          <Pencil className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
      {editing && (
        <DoctorDialog
          key={editing === "new" ? "new" : editing.id}
          doctor={editing === "new" ? undefined : editing}
          specialtyId={specialtyId}
          open
          onClose={() => setEditing(null)}
        />
      )}
      {scheduling && <ScheduleDialog doctor={scheduling} onClose={() => setScheduling(null)} />}
    </>
  )
}
