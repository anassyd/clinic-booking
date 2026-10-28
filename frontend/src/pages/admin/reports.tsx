import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subDays } from "date-fns"
import { CalendarCheck2, Download, Gauge, Wallet, UserX } from "lucide-react"
import { motion } from "motion/react"
import { toast } from "sonner"

import { CountUp } from "@/components/shared/count-up"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLocale } from "@/i18n"
import { downloadReportCsv, getReport, type ReportRow } from "@/lib/admin-api"
import { errorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

import { Panel } from "./ui"

type Range = "week" | "month" | "last30"
const ISO = "yyyy-MM-dd"
const WEEK = { weekStartsOn: 6 as const } // Saturday

function rangeFor(range: Range) {
  const now = new Date()
  const [from, to] =
    range === "week"
      ? [startOfWeek(now, WEEK), endOfWeek(now, WEEK)]
      : range === "month"
        ? [startOfMonth(now), endOfMonth(now)]
        : [subDays(now, 29), now]
  return { from: format(from, ISO), to: format(to, ISO) }
}

/** Occupancy per doctor: one measure, one hue, sorted so the ranking reads at a glance. */
function OccupancyChart({ rows }: { rows: ReportRow[] }) {
  const { t, tr, num, lang } = useLocale()
  const pct = (v: number) => (lang === "ar" ? `${num(Math.round(v * 100))}٪` : `${Math.round(v * 100)}%`)
  const sorted = [...rows].sort((a, b) => b.occupancy - a.occupancy)

  return (
    <figure>
      <ol className="space-y-2.5" aria-label={t("admin.reports.chartTitle")}>
        {sorted.map((r, i) => (
          <li key={r.doctorId} className="grid grid-cols-[minmax(7rem,11rem)_1fr_3.5rem] items-center gap-3 text-sm">
            <span className="truncate text-muted-foreground">{tr(r.doctor)}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Hit target is the full row height, larger than the 12px bar */}
                <span className="relative flex h-6 cursor-default items-center" tabIndex={0}>
                  <span className="absolute inset-x-0 h-3 rounded-full bg-muted" />
                  <motion.span
                    className="relative h-3 origin-[var(--o)] rounded-full bg-primary [--o:left] rtl:[--o:right]"
                    style={{ width: `${Math.max(r.occupancy * 100, 1.5)}%` }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.6, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{tr(r.doctor)}</p>
                <p>{t("admin.reports.of", { booked: num(r.booked), capacity: num(r.capacity) })}</p>
              </TooltipContent>
            </Tooltip>
            <span className="text-end font-semibold tabular">{pct(r.occupancy)}</span>
          </li>
        ))}
      </ol>
      <figcaption className="mt-4 text-xs text-muted-foreground">{t("admin.reports.chartHint")}</figcaption>
    </figure>
  )
}

export default function ReportsPage() {
  const { t, tr, num, money, lang } = useLocale()
  const [range, setRange] = useState<Range>("month")
  const { from, to } = rangeFor(range)
  const q = useQuery({ queryKey: ["admin", "report", from, to], queryFn: () => getReport(from, to) })
  const csv = useMutation({ mutationFn: () => downloadReportCsv(from, to), onError: (e) => toast.error(errorMessage(t, e)) })

  const totals = q.data?.totals
  const rate = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
  const percent = (n: number) => (lang === "ar" ? `${num(n)}٪` : `${n}%`)

  const kpis = totals
    ? [
        { icon: CalendarCheck2, label: t("admin.reports.kpis.booked"), value: <CountUp value={totals.booked} /> },
        { icon: Gauge, label: t("admin.reports.kpis.occupancy"), value: percent(rate(totals.booked, totals.capacity)) },
        { icon: UserX, label: t("admin.reports.kpis.noShow"), value: percent(rate(totals.noShow, totals.booked)) },
        { icon: Wallet, label: t("admin.reports.kpis.revenue"), value: money(totals.revenue) },
      ]
    : []

  return (
    <>
      <PageHeader
        title={t("admin.reports.title")}
        subtitle={t("admin.reports.subtitle")}
        actions={
          <>
            <div className="flex rounded-xl bg-muted p-1" role="tablist" aria-label={t("admin.reports.title")}>
              {(["week", "month", "last30"] as Range[]).map((r) => (
                <button
                  key={r}
                  role="tab"
                  aria-selected={range === r}
                  onClick={() => setRange(r)}
                  className={cn("relative cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium", range === r ? "text-foreground" : "text-muted-foreground")}
                >
                  {range === r && <motion.span layoutId="report-range" className="absolute inset-0 rounded-lg bg-card shadow-sm" />}
                  <span className="relative">{t(`admin.reports.ranges.${r}`)}</span>
                </button>
              ))}
            </div>
            <Button variant="outline" className="rounded-xl" onClick={() => csv.mutate()} disabled={csv.isPending}>
              {csv.isPending ? <Spinner /> : <Download className="size-4" aria-hidden="true" />}
              {t("admin.reports.export")}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {q.isLoading
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)
          : kpis.map((k, i) => (
              <motion.div
                key={k.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-3xl border bg-card p-5 shadow-soft"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <k.icon className="size-5" aria-hidden="true" />
                </span>
                <p className="mt-4 text-2xl font-extrabold tabular">{k.value}</p>
                <p className="text-sm text-muted-foreground">{k.label}</p>
              </motion.div>
            ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_3fr]">
        <Panel title={t("admin.reports.chartTitle")}>
          <div className="p-5">{q.data ? <OccupancyChart rows={q.data.data} /> : <Skeleton className="h-72 rounded-2xl" />}</div>
        </Panel>

        <Panel className="min-w-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-5">{t("admin.reports.table.doctor")}</TableHead>
                <TableHead className="text-end">{t("admin.reports.table.booked")}</TableHead>
                <TableHead className="text-end">{t("admin.reports.table.completed")}</TableHead>
                <TableHead className="text-end">{t("admin.reports.table.noShow")}</TableHead>
                <TableHead className="text-end">{t("admin.reports.table.cancelled")}</TableHead>
                <TableHead className="pe-5 text-end">{t("admin.reports.table.revenue")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.data.map((r) => (
                <TableRow key={r.doctorId}>
                  <TableCell className="ps-5">
                    <p className="font-medium">{tr(r.doctor)}</p>
                    <p className="text-xs text-muted-foreground">{tr(r.specialty)}</p>
                  </TableCell>
                  <TableCell className="text-end tabular">{num(r.booked)}</TableCell>
                  <TableCell className="text-end tabular">{num(r.completed)}</TableCell>
                  <TableCell className="text-end tabular">{num(r.noShow)}</TableCell>
                  <TableCell className="text-end tabular">{num(r.cancelled)}</TableCell>
                  <TableCell className="pe-5 text-end font-medium tabular">{money(r.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </div>
    </>
  )
}
