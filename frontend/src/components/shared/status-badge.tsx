import { Ban, CheckCircle2, CircleDashed, CreditCard, Hourglass, UserX } from "lucide-react"

import { useLocale } from "@/i18n"
import type { AppointmentStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const STYLES: Record<AppointmentStatus, { className: string; icon: typeof CheckCircle2 }> = {
  held: { className: "bg-chart-3/15 text-foreground ring-chart-3/30", icon: CreditCard },
  pending: { className: "bg-warning/20 text-warning-foreground ring-warning/40 dark:text-warning", icon: Hourglass },
  confirmed: { className: "bg-primary/10 text-primary ring-primary/25", icon: CheckCircle2 },
  completed: { className: "bg-success/12 text-success ring-success/25", icon: CircleDashed },
  no_show: { className: "bg-muted text-muted-foreground ring-border", icon: UserX },
  cancelled: { className: "bg-destructive/10 text-destructive ring-destructive/20", icon: Ban },
}

export const STATUS_DOT: Record<AppointmentStatus, string> = {
  held: "bg-chart-3",
  pending: "bg-warning",
  confirmed: "bg-primary",
  completed: "bg-success",
  no_show: "bg-muted-foreground",
  cancelled: "bg-destructive",
}

export function StatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  const { t } = useLocale()
  const { className: tone, icon: Icon } = STYLES[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {t(`status.${status}`)}
    </span>
  )
}
