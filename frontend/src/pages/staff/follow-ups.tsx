import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { differenceInCalendarDays, parse } from "date-fns"
import { CalendarPlus, Phone, Repeat2, Stethoscope, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLocale } from "@/i18n"
import { dismissFollowUp, followUpBookingPath, getDoctorSync, getFollowUps, getPatientSync } from "@/lib/api"
import { errorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

/** Follow-ups the doctors asked for: reception calls the patient and books them like any visit. */
export function FollowUpQueue() {
  const { t, tr, fdate, num } = useLocale()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["follow-ups"], queryFn: getFollowUps })

  const dismiss = useMutation({
    mutationFn: dismissFollowUp,
    onSuccess: () => {
      toast.success(t("followUp.dismissed"))
      qc.invalidateQueries({ queryKey: ["follow-ups"] })
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  })

  return (
    <section className="rounded-3xl border bg-card shadow-soft" aria-labelledby="follow-ups-title">
      <div className="flex items-center justify-between border-b p-5">
        <h2 id="follow-ups-title" className="flex items-center gap-2 font-semibold">
          <Repeat2 className="size-4 text-primary" aria-hidden="true" />
          {t("followUp.title")}
        </h2>
        <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-semibold text-primary tabular">{num(q.data?.length ?? 0)}</span>
      </div>
      <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
        {q.isLoading ? (
          Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : q.data?.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t("followUp.empty")}</p>
        ) : (
          <AnimatePresence initial={false}>
            {q.data?.map((a) => {
              const p = getPatientSync(a.patientId)
              const d = getDoctorSync(a.doctorId)
              const due = parse(a.followUpDue!, "yyyy-MM-dd", new Date())
              const left = differenceInCalendarDays(due, new Date())
              const date = fdate(due, "EEE d MMMM")
              return (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-2xl border bg-background p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p?.name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Stethoscope className="size-3.5" aria-hidden="true" />
                        {d && tr(d.name)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button asChild size="sm" className="h-8 rounded-lg">
                        <Link to={followUpBookingPath(a)}>
                          <CalendarPlus className="size-3.5" aria-hidden="true" />
                          {t("followUp.book")}
                        </Link>
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={t("followUp.dismiss")}
                            disabled={dismiss.isPending}
                            onClick={() => dismiss.mutate(a.id)}
                          >
                            <X className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("followUp.dismiss")}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span
                      className={cn(
                        "rounded-lg px-2 py-0.5 font-medium",
                        left < 0
                          ? "bg-destructive/10 text-destructive"
                          : left <= 2
                            ? "bg-warning/15 text-warning-foreground dark:text-warning"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {t(left < 0 ? "followUp.overdue" : left <= 2 ? "followUp.soon" : "followUp.dueBy", { date })}
                    </span>
                    <a href={`tel:${p?.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline" dir="ltr">
                      <Phone className="size-3.5" aria-hidden="true" />
                      {p?.phone}
                    </a>
                  </div>
                  {a.followUpNote && <p className="mt-2 rounded-lg bg-muted/60 px-2 py-1 text-xs text-muted-foreground">{a.followUpNote}</p>}
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </section>
  )
}
