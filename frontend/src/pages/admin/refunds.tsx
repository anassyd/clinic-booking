import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNowStrict, parse } from "date-fns"
import { BadgeCheck, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLocale } from "@/i18n"
import { adminRefunds, retryRefund } from "@/lib/admin-api"
import { getDoctorSync } from "@/lib/api"
import { errorMessage } from "@/lib/errors"

import { Panel } from "./ui"

export default function AdminRefundsPage() {
  const { sep, t, tr, money, num, fdate, time, dateLocale } = useLocale()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["admin", "refunds"], queryFn: adminRefunds })

  const retry = useMutation({
    mutationFn: (id: number) => retryRefund(id),
    onSuccess: () => {
      toast.success(t("admin.refunds.retried"))
      qc.invalidateQueries({ queryKey: ["admin", "refunds"] })
    },
    // 502 = the gateway refused again; the row stays with its new error
    onError: (e) => {
      toast.error(t("admin.refunds.stillFailing"), { description: errorMessage(t, e) })
      qc.invalidateQueries({ queryKey: ["admin", "refunds"] })
    },
  })

  return (
    <>
      <PageHeader title={t("admin.refunds.title")} subtitle={t("admin.refunds.subtitle")} />
      <Panel className="overflow-hidden">
        {q.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : q.data?.length === 0 ? (
          <Empty className="py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BadgeCheck />
              </EmptyMedia>
              <EmptyTitle>{t("admin.refunds.empty")}</EmptyTitle>
              <EmptyDescription>{t("admin.refunds.emptyHint")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-5">{t("book.steps.patient")}</TableHead>
                <TableHead>{t("admin.refunds.cancelledOn")}</TableHead>
                <TableHead className="text-end">{t("book.total")}</TableHead>
                <TableHead>{t("admin.refunds.error")}</TableHead>
                <TableHead className="pe-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.map((r) => {
                const a = r.appointment
                const day = parse(a.date, "yyyy-MM-dd", new Date())
                return (
                  <TableRow key={r.id}>
                    <TableCell className="ps-5">
                      <p className="font-medium">{a.patient?.name}</p>
                      <p className="text-xs text-muted-foreground tabular" dir="ltr">
                        {a.patient?.phone}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p>{tr(getDoctorSync(a.doctorId)?.name)}</p>
                      <p className="text-xs text-muted-foreground">
                        {fdate(day, "EEEE d MMMM")}{sep}{time(a.start)}
                      </p>
                    </TableCell>
                    <TableCell className="text-end font-semibold tabular">{money(r.amount)}</TableCell>
                    <TableCell className="max-w-xs">
                      <p className="line-clamp-2 text-sm text-destructive">{r.error}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("admin.refunds.attempts", { n: num(r.attempts) })}
                        {r.failedAt && `${sep}${formatDistanceToNowStrict(new Date(r.failedAt), { addSuffix: true, locale: dateLocale })}`}
                      </p>
                    </TableCell>
                    <TableCell className="pe-5 text-end">
                      <Button
                        size="sm"
                        className="rounded-lg"
                        disabled={retry.isPending && retry.variables === r.id}
                        onClick={() => retry.mutate(r.id)}
                      >
                        {retry.isPending && retry.variables === r.id ? <Spinner /> : <RotateCcw className="size-4" aria-hidden="true" />}
                        {t("admin.refunds.retry")}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  )
}
