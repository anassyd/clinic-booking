import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format, parse } from "date-fns"
import { CalendarOff, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLocale } from "@/i18n"
import { adminDoctors, adminTimeOff, createTimeOff, deleteTimeOff, type TimeOff } from "@/lib/admin-api"
import { errorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

import { errorFor, Panel, SelectField, serverErrors, TextField, type ServerErrors } from "./ui"

function TimeOffDialog({ onClose }: { onClose: () => void }) {
  const { t, tr } = useLocale()
  const qc = useQueryClient()
  const doctors = useQuery({ queryKey: ["admin", "doctors"], queryFn: adminDoctors })
  const [doctorId, setDoctorId] = useState<number | null>(null)
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [partial, setPartial] = useState(false)
  const [start, setStart] = useState("09:00")
  const [end, setEnd] = useState("13:00")
  const [reason, setReason] = useState("")
  const [cancelAffected, setCancelAffected] = useState(false)
  const [errors, setErrors] = useState<ServerErrors>()

  const save = useMutation({
    mutationFn: () =>
      createTimeOff({
        doctor_id: doctorId,
        date,
        start: partial ? start : null,
        end: partial ? end : null,
        reason: reason || null,
        cancel_affected: cancelAffected,
      }),
    onSuccess: (res) => {
      const n = res.affected.length
      toast.success(t("admin.timeOff.created"), {
        description: n ? (cancelAffected ? t("admin.timeOff.affectedCancelled", { n }) : t("admin.timeOff.affected", { n })) : undefined,
      })
      qc.invalidateQueries({ queryKey: ["admin", "timeOff"] })
      qc.invalidateQueries({ queryKey: ["availability"] })
      onClose()
    },
    onError: (e) => {
      setErrors(serverErrors(e))
      toast.error(errorMessage(t, e))
    },
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("admin.timeOff.add")}</DialogTitle>
        </DialogHeader>
        <form
          id="timeoff-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          <SelectField id="t-who" label={t("admin.timeOff.who")} value={doctorId ?? ""} onChange={(e) => setDoctorId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t("admin.timeOff.center")}</option>
            {doctors.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {tr(d.name)}
              </option>
            ))}
          </SelectField>
          <TextField id="t-date" type="date" label={t("admin.timeOff.date")} value={date} onChange={(e) => setDate(e.target.value)} error={errorFor(errors, "date")} required />
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {[false, true].map((p) => (
              <button
                key={String(p)}
                type="button"
                role="radio"
                aria-checked={partial === p}
                onClick={() => setPartial(p)}
                className={cn(
                  "h-10 cursor-pointer rounded-xl border text-sm font-medium",
                  partial === p ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "hover:bg-muted",
                )}
              >
                {p ? t("admin.timeOff.partial") : t("admin.timeOff.fullDay")}
              </button>
            ))}
          </div>
          {partial && (
            <div className="grid grid-cols-2 gap-4">
              <TextField id="t-start" type="time" step={1800} dir="ltr" label={t("admin.doctors.from")} value={start} onChange={(e) => setStart(e.target.value)} error={errorFor(errors, "start")} />
              <TextField id="t-end" type="time" step={1800} dir="ltr" label={t("admin.doctors.to")} value={end} onChange={(e) => setEnd(e.target.value)} error={errorFor(errors, "end")} />
            </div>
          )}
          <TextField id="t-reason" label={t("admin.timeOff.reason")} value={reason} onChange={(e) => setReason(e.target.value)} />
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm">
            <Checkbox checked={cancelAffected} onCheckedChange={(v) => setCancelAffected(v === true)} className="mt-0.5" />
            {t("admin.timeOff.cancelAffected")}
          </label>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("admin.common.cancel")}
          </Button>
          <Button type="submit" form="timeoff-form" disabled={save.isPending} className="rounded-xl">
            {save.isPending && <Spinner />}
            {t("admin.common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminTimeOffPage() {
  const { t, tr, fdate, hijri, time } = useLocale()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["admin", "timeOff"], queryFn: () => adminTimeOff() })
  const doctors = useQuery({ queryKey: ["admin", "doctors"], queryFn: adminDoctors })
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<TimeOff | null>(null)

  const remove = useMutation({
    mutationFn: (id: number) => deleteTimeOff(id),
    onSuccess: () => {
      toast.success(t("admin.timeOff.deleted"))
      setRemoving(null)
      qc.invalidateQueries({ queryKey: ["admin", "timeOff"] })
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  })

  const doctorName = (id: number | null) => (id ? tr(doctors.data?.find((d) => d.id === id)?.name) : t("admin.timeOff.center"))

  return (
    <>
      <PageHeader
        title={t("admin.timeOff.title")}
        subtitle={t("admin.timeOff.subtitle")}
        actions={
          <Button className="rounded-xl shadow-soft" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden="true" />
            {t("admin.timeOff.add")}
          </Button>
        }
      />
      <Panel className="overflow-hidden">
        {q.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : q.data?.length === 0 ? (
          <Empty className="py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarOff />
              </EmptyMedia>
              <EmptyTitle>{t("admin.timeOff.empty")}</EmptyTitle>
              <EmptyDescription>{t("admin.timeOff.subtitle")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-5">{t("admin.timeOff.date")}</TableHead>
                <TableHead>{t("admin.timeOff.who")}</TableHead>
                <TableHead>{t("book.steps.time")}</TableHead>
                <TableHead>{t("admin.timeOff.reason")}</TableHead>
                <TableHead className="pe-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.map((o) => {
                const day = parse(o.date.slice(0, 10), "yyyy-MM-dd", new Date())
                return (
                  <TableRow key={o.id}>
                    <TableCell className="ps-5">
                      <p className="font-medium">{fdate(day, "EEEE d MMMM yyyy")}</p>
                      <p className="text-xs text-muted-foreground">{hijri(day)}</p>
                    </TableCell>
                    <TableCell>{doctorName(o.doctor_id)}</TableCell>
                    <TableCell className="tabular">
                      {o.start_time ? `${time(o.start_time.slice(0, 5))} – ${time(o.end_time!.slice(0, 5))}` : t("admin.timeOff.fullDay")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{o.reason ?? t("admin.common.none")}</TableCell>
                    <TableCell className="pe-5 text-end">
                      <Button size="icon-sm" variant="ghost" aria-label={t("admin.common.delete")} onClick={() => setRemoving(o)} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      {adding && <TimeOffDialog onClose={() => setAdding(false)} />}
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.common.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.timeOff.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => removing && remove.mutate(removing.id)}>
              {t("admin.common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
