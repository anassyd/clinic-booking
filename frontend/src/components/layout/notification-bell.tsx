import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNowStrict, isToday, isTomorrow, parse } from "date-fns"
import { Bell, CalendarClock, CalendarPlus, CalendarX2, CheckCheck, Hourglass, Repeat2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useLocale } from "@/i18n"
import { getDoctorSync, getNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api"
import type { StaffNotification } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAuth } from "@/providers/auth"

const ICON = {
  new_pending: { icon: Hourglass, tone: "bg-warning/20 text-warning-foreground dark:text-warning" },
  new_booking: { icon: CalendarPlus, tone: "bg-primary/12 text-primary" },
  cancelled: { icon: CalendarX2, tone: "bg-destructive/10 text-destructive" },
  rescheduled: { icon: CalendarClock, tone: "bg-chart-3/15 text-foreground" },
  follow_up_requested: { icon: Repeat2, tone: "bg-success/12 text-success" },
} as const

/** Header bell for reception and doctors; polls every 30 s (no websockets yet). */
export function NotificationBell() {
  const { sep, t, tr, fdate, time, num, dateLocale } = useLocale()
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const q = useQuery({ queryKey: ["notifications"], queryFn: getNotifications, refetchInterval: 30_000 })
  const unread = q.data?.unread ?? 0

  const ymd = (d: string) => parse(d, "yyyy-MM-dd", new Date())
  const when = (date?: string, start?: string) => {
    if (!date) return ""
    const d = ymd(date)
    const day = isToday(d) ? t("staff.today") : isTomorrow(d) ? t("bell.tomorrow") : fdate(d, "EEE d MMMM")
    return start ? `${day} ${time(start)}` : day
  }

  const describe = (n: StaffNotification) => {
    const { patient, doctorId, date, start, fromDate, fromStart, due } = n.data
    const doctor = user?.role === "doctor" ? undefined : getDoctorSync(doctorId)
    const parts = [patient, doctor && tr(doctor.name)]
    if (n.event === "follow_up_requested") parts.push(t("bell.dueBy", { date: due ? fdate(ymd(due), "EEE d MMMM") : "" }))
    else if (n.event === "rescheduled") parts.push(t("bell.moved", { from: when(fromDate, fromStart), to: when(date, start) }))
    else parts.push(when(date, start))
    return parts.filter(Boolean).join(sep)
  }

  // Something new arrived: refresh the screens it concerns and say so once
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!q.data) return
    const fresh = q.data.items.filter((n) => !n.readAt && seen.current && !seen.current.has(n.id))
    seen.current = new Set(q.data.items.map((n) => n.id))
    if (fresh.length === 0) return
    qc.invalidateQueries({ queryKey: ["appointments"] })
    qc.invalidateQueries({ queryKey: ["follow-ups"] })
    toast(t(`bell.events.${fresh[0].event}`), { description: describe(fresh[0]) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data])

  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] })
  const readOne = useMutation({ mutationFn: markNotificationRead, onSuccess: refresh })
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh })

  const go = (n: StaffNotification) => {
    if (!n.readAt) readOne.mutate(n.id)
    setOpen(false)
    navigate(user?.role === "doctor" ? "/doctor" : "/staff")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label={`${t("bell.title")}${unread ? ` (${num(unread)})` : ""}`}>
          <Bell className={cn("size-5", unread > 0 && "origin-top motion-safe:animate-[bell-ring_1s_ease-in-out_1]")} />
          {unread > 0 && (
            <span className="absolute end-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] leading-none font-bold text-white tabular">
              {unread > 9 ? `${num(9)}+` : num(unread)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <p className="font-semibold">
            {t("bell.title")}
            {unread > 0 && <span className="ms-2 text-xs font-normal text-muted-foreground">{t("bell.unread", { n: num(unread) })}</span>}
          </p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 rounded-lg text-xs" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
              <CheckCheck className="size-3.5" aria-hidden="true" />
              {t("bell.readAll")}
            </Button>
          )}
        </div>
        <div className="max-h-[min(26rem,70dvh)] overflow-y-auto">
          {q.data?.items.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">{t("bell.empty")}</p>
          ) : (
            q.data?.items.map((n) => {
              const { icon: Icon, tone } = ICON[n.event] ?? ICON.new_booking
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => go(n)}
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-3 border-b px-4 py-3 text-start transition-colors last:border-b-0 hover:bg-muted/60",
                    !n.readAt && "bg-primary/5",
                  )}
                >
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", tone)}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", !n.readAt && "font-semibold")}>{t(`bell.events.${n.event}`)}</span>
                    <span className="block text-xs text-muted-foreground">{describe(n)}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground/80">
                      {formatDistanceToNowStrict(new Date(n.createdAt), { addSuffix: true, locale: dateLocale })}
                    </span>
                  </span>
                  {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label={t("bell.new")} />}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
