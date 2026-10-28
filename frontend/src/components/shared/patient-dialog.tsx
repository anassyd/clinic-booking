import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { IdCard, Mail, Phone, UserPlus, User as UserIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { useLocale } from "@/i18n"
import { createPatient } from "@/lib/api"
import { errorMessage } from "@/lib/errors"
import type { Patient } from "@/lib/types"
import { cn } from "@/lib/utils"
import { patientSchema, type PatientForm } from "@/lib/validation"

import { FormField } from "./form-field"

/** The server attaches the patient to the signed-in account when a patient creates it. */
export function PatientDialog({
  defaults,
  onCreated,
}: {
  defaults?: Partial<PatientForm>
  onCreated: (patient: Patient) => void
}) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()
  const form = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
    defaultValues: { name: "", email: "", phone: "", nationalId: "", birthDate: "", gender: undefined, ...defaults },
  })
  const mutation = useMutation({
    mutationFn: (v: PatientForm) => createPatient(v),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["patients"] })
      onCreated(p)
      setOpen(false)
      form.reset()
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  })
  const errors = form.formState.errors

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex min-h-24 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
        >
          <UserPlus className="size-5" aria-hidden="true" />
          {t("book.addPatient")}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("book.addPatient")}</DialogTitle>
          <DialogDescription>{t("book.choosePatient")}</DialogDescription>
        </DialogHeader>
        <form id="patient-form" onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
          <FormField id="p-name" label={t("patient.name")} icon={<UserIcon className="size-4" />} error={errors.name} {...form.register("name")} />
          <FormField id="p-email" type="email" label={t("patient.email")} icon={<Mail className="size-4" />} error={errors.email} {...form.register("email")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="p-phone"
              type="tel"
              dir="ltr"
              inputMode="tel"
              placeholder="05XXXXXXXX"
              label={t("patient.phone")}
              icon={<Phone className="size-4" />}
              error={errors.phone}
              {...form.register("phone")}
            />
            <FormField id="p-birth" type="date" label={t("patient.birthDate")} error={errors.birthDate} {...form.register("birthDate")} />
          </div>
          <FormField
            id="p-national-id"
            inputMode="numeric"
            dir="ltr"
            maxLength={10}
            placeholder="1XXXXXXXXX"
            label={t("patient.nationalId")}
            icon={<IdCard className="size-4" />}
            error={errors.nationalId}
            {...form.register("nationalId")}
          />
          <Controller
            control={form.control}
            name="gender"
            render={({ field, fieldState }) => (
              <Field data-invalid={!!fieldState.error || undefined}>
                <FieldLabel id="gender-label">{t("patient.gender")}</FieldLabel>
                <div role="radiogroup" aria-labelledby="gender-label" className="grid grid-cols-2 gap-2">
                  {(["male", "female"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      role="radio"
                      aria-checked={field.value === g}
                      onClick={() => field.onChange(g)}
                      className={cn(
                        "h-11 cursor-pointer rounded-xl border text-sm font-medium transition-colors",
                        field.value === g ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "hover:bg-muted",
                      )}
                    >
                      {t(`patient.${g}`)}
                    </button>
                  ))}
                </div>
                {fieldState.error?.message && <FieldError>{t(fieldState.error.message)}</FieldError>}
              </Field>
            )}
          />
        </form>
        <DialogFooter>
          <Button type="submit" form="patient-form" className="w-full rounded-xl sm:w-auto" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner />}
            {t("patient.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
