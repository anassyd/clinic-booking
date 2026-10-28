import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Save } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useLocale } from "@/i18n"
import { getSettings, saveSettings, type ClinicSettings } from "@/lib/admin-api"
import { errorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

import { errorFor, Panel, serverErrors, TextField, type ServerErrors } from "./ui"

type NumericKey = Exclude<keyof ClinicSettings, "weekly_off_days">

const GROUPS: { title: string; keys: NumericKey[] }[] = [
  { title: "booking", keys: ["min_booking_lead_hours", "max_booking_days_ahead", "max_active_per_patient_per_day"] },
  { title: "changes", keys: ["edit_cancel_cutoff_hours", "reminder_before_hours"] },
  { title: "confirmation", keys: ["pending_expiry_hours", "pending_expiry_before_appt_hours", "payment_hold_minutes", "max_pending_per_account"] },
  { title: "billing", keys: ["vat_rate"] },
]
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5]

export default function AdminSettingsPage() {
  const { t, fdate } = useLocale()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: getSettings })
  const [form, setForm] = useState<ClinicSettings | null>(null)
  const [errors, setErrors] = useState<ServerErrors>()
  // Seed the form once; a background refetch must not wipe unsaved edits
  useEffect(() => {
    if (q.data && !form) setForm(q.data)
  }, [q.data, form])

  const dayName = (dow: number) => fdate(new Date(2026, 9, 24 + ((dow - 6 + 7) % 7)), "EEEE")
  const dirty = !!form && JSON.stringify(form) !== JSON.stringify(q.data)

  const save = useMutation({
    mutationFn: () => saveSettings(form!),
    onSuccess: (data) => {
      toast.success(t("admin.common.saved"))
      setErrors(undefined)
      qc.setQueryData(["admin", "settings"], data)
      qc.invalidateQueries({ queryKey: ["availability"] })
    },
    onError: (e) => {
      setErrors(serverErrors(e))
      toast.error(errorMessage(t, e))
    },
  })

  return (
    <>
      <PageHeader
        title={t("admin.settings.title")}
        subtitle={t("admin.settings.subtitle")}
        actions={
          <Button className="rounded-xl shadow-soft" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            {save.isPending ? <Spinner /> : <Save className="size-4" aria-hidden="true" />}
            {t("admin.common.save")}
          </Button>
        }
      />
      {!form ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-52 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={t("admin.settings.offDays")} className="lg:col-span-2">
            <div className="flex flex-wrap gap-2 p-5" role="group" aria-label={t("admin.settings.offDays")}>
              {WEEK_ORDER.map((d) => {
                const off = form.weekly_off_days.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={off}
                    onClick={() =>
                      setForm({
                        ...form,
                        weekly_off_days: off ? form.weekly_off_days.filter((x) => x !== d) : [...form.weekly_off_days, d],
                      })
                    }
                    className={cn(
                      "h-10 cursor-pointer rounded-xl border px-4 text-sm font-medium transition-colors",
                      off ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {dayName(d)}
                  </button>
                )
              })}
            </div>
          </Panel>
          {GROUPS.map((g) => (
            <Panel key={g.title} title={t(`admin.settings.${g.title}`)}>
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                {g.keys.map((key) => (
                  <TextField
                    key={key}
                    id={`set-${key}`}
                    type="number"
                    min={0}
                    step={key === "vat_rate" ? 0.5 : 1}
                    inputMode="decimal"
                    label={t(`admin.settings.fields.${key}`)}
                    hint={key === "vat_rate" ? t("admin.settings.vatHint") : undefined}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                    error={errorFor(errors, key)}
                  />
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  )
}
