import type { ComponentProps, ReactNode } from "react"
import { CheckCircle2, CircleSlash } from "lucide-react"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useLocale } from "@/i18n"
import { ApiError } from "@/lib/http"
import { cn } from "@/lib/utils"

/** Field-level messages from a 422 (already localised by the server). */
export type ServerErrors = Record<string, string[]> | undefined

export const serverErrors = (e: unknown): ServerErrors => (e instanceof ApiError ? e.errors : undefined)

/** First message for a key, also matching nested keys like "name.ar". */
export const errorFor = (errors: ServerErrors, key: string) =>
  errors?.[key]?.[0] ?? Object.entries(errors ?? {}).find(([k]) => k.startsWith(`${key}.`))?.[1]?.[0]

export function TextField({
  id,
  label,
  hint,
  error,
  multiline,
  className,
  ...props
}: { id: string; label: string; hint?: string; error?: string; multiline?: boolean } & ComponentProps<"input"> &
  ComponentProps<"textarea">) {
  return (
    <Field data-invalid={!!error || undefined} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? (
        <Textarea id={id} aria-invalid={!!error || undefined} className="min-h-20 rounded-xl" {...props} />
      ) : (
        <Input id={id} aria-invalid={!!error || undefined} className="h-10 rounded-xl" {...props} />
      )}
      {hint && !error && <FieldDescription>{hint}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}

export function SelectField({
  id,
  label,
  error,
  children,
  ...props
}: { id: string; label: string; error?: string; children: ReactNode } & ComponentProps<"select">) {
  return (
    <Field data-invalid={!!error || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select
        id={id}
        aria-invalid={!!error || undefined}
        className="h-10 w-full cursor-pointer rounded-xl border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        {...props}
      >
        {children}
      </select>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}

export function ActiveBadge({ active }: { active: boolean }) {
  const { t } = useLocale()
  const Icon = active ? CheckCircle2 : CircleSlash
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        active ? "bg-success/10 text-success ring-success/25" : "bg-muted text-muted-foreground ring-border",
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {active ? t("admin.common.active") : t("admin.common.inactive")}
    </span>
  )
}

export function Panel({ title, children, actions, className }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-3xl border bg-card shadow-soft", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          {title && <h2 className="font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}
