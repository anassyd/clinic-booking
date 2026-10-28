import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Banknote, CreditCard, Landmark } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { useLocale } from "@/i18n"
import { getPatientSync, markPaid } from "@/lib/api"
import { errorMessage } from "@/lib/errors"
import type { Appointment, DeskMethod, DeskPayment } from "@/lib/types"
import { cn } from "@/lib/utils"

const METHODS = [
  { key: "cash", icon: Banknote },
  { key: "card", icon: CreditCard },
  { key: "transfer", icon: Landmark },
] as const satisfies readonly { key: DeskMethod; icon: typeof Banknote }[]

/** A transfer needs its number; a POS receipt number is optional. */
export const isDeskPaymentValid = (p: DeskPayment) => p.method !== "transfer" || !!p.reference?.trim()

/** Method picker + reference field, shared by quick booking and the collect dialog. */
export function DeskPaymentFields({
  value,
  onChange,
  showErrors,
}: {
  value: DeskPayment
  onChange: (v: DeskPayment) => void
  showErrors?: boolean
}) {
  const { t } = useLocale()
  const invalid = showErrors && !isDeskPaymentValid(value)

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label={t("staff.method")} className="grid grid-cols-3 gap-2">
        {METHODS.map((m) => {
          const selected = value.method === m.key
          return (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({ method: m.key, reference: value.reference })}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border bg-card px-2 py-3 text-sm font-medium transition-[border-color,box-shadow,color]",
                selected ? "border-primary text-primary shadow-soft ring-2 ring-primary/20" : "hover:border-primary/40",
              )}
            >
              <m.icon className="size-5" aria-hidden="true" />
              {t(`staff.methods.${m.key}`)}
              {m.key === "card" && <span className="text-[11px] font-normal text-muted-foreground">{t("staff.methods.cardHint")}</span>}
            </button>
          )
        })}
      </div>
      {value.method !== "cash" && (
        <div className="space-y-1.5">
          <Label htmlFor="desk-reference">{t(value.method === "card" ? "staff.referenceCard" : "staff.referenceTransfer")}</Label>
          <Input
            id="desk-reference"
            dir="ltr"
            value={value.reference ?? ""}
            onChange={(e) => onChange({ ...value, reference: e.target.value })}
            aria-invalid={invalid || undefined}
            maxLength={100}
            className="h-11 rounded-xl tabular"
          />
          {invalid && <p className="text-xs text-destructive">{t("staff.referenceRequired")}</p>}
        </div>
      )}
    </div>
  )
}

/** "Collect" at reception: choose how the patient paid, then record it. */
export function CollectDialog({ appointment, onOpenChange }: { appointment?: Appointment; onOpenChange: (open: boolean) => void }) {
  const { t, money, time } = useLocale()
  const qc = useQueryClient()
  const [payment, setPayment] = useState<DeskPayment>({ method: "cash" })
  const [tried, setTried] = useState(false)

  const mutation = useMutation({
    mutationFn: () => markPaid(appointment!.id, payment),
    onSuccess: () => {
      toast.success(t("staff.collected"))
      qc.invalidateQueries({ queryKey: ["appointments"] })
      onOpenChange(false)
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  })

  const close = (open: boolean) => {
    if (!open) {
      setPayment({ method: "cash" })
      setTried(false)
    }
    onOpenChange(open)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (isDeskPaymentValid(payment)) mutation.mutate()
  }

  return (
    <Dialog open={!!appointment} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        {appointment && (
          <form onSubmit={submit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>{t("staff.collectTitle", { amount: money(appointment.price) })}</DialogTitle>
              <DialogDescription>
                {t("staff.collectFor", { name: getPatientSync(appointment.patientId)?.name ?? "", time: time(appointment.start) })}
              </DialogDescription>
            </DialogHeader>
            <DeskPaymentFields value={payment} onChange={setPayment} showErrors={tried} />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending} className="h-11 w-full rounded-xl">
                {mutation.isPending && <Spinner />}
                {t("staff.collectCta")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
