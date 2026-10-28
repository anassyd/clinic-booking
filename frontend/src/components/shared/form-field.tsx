import type { ComponentProps, ReactNode } from "react"
import type { FieldError as RhfError } from "react-hook-form"

import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/i18n"

interface Props extends ComponentProps<typeof Input> {
  id: string
  label: string
  error?: RhfError
  icon?: ReactNode
}

/** Visible label + input + translated inline error (never placeholder-only). */
export function FormField({ id, label, error, icon, className, ...input }: Props) {
  const { t } = useLocale()
  return (
    <Field data-invalid={!!error || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted-foreground">
            {icon}
          </span>
        )}
        <Input
          id={id}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`h-11 rounded-xl ${icon ? "ps-10" : ""} ${className ?? ""}`}
          {...input}
        />
      </div>
      {error?.message && <FieldError id={`${id}-error`}>{t(error.message)}</FieldError>}
    </Field>
  )
}
