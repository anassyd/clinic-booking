import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLocale } from "@/i18n"
import { adminStaff, saveStaff, type AdminUser, type StaffInput } from "@/lib/admin-api"
import { errorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

import { ActiveBadge, errorFor, Panel, SelectField, serverErrors, TextField, type ServerErrors } from "./ui"

const ROLES = ["receptionist", "doctor", "admin"] as const

function StaffDialog({ user, onClose }: { user?: AdminUser; onClose: () => void }) {
  const { t } = useLocale()
  const qc = useQueryClient()
  const [form, setForm] = useState<StaffInput>(() => ({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    password: "",
    role: (user?.role as StaffInput["role"]) ?? "receptionist",
    gender: user?.gender ?? null,
    is_active: user?.isActive ?? true,
  }))
  const [errors, setErrors] = useState<ServerErrors>()
  const set = <K extends keyof StaffInput>(k: K, v: StaffInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = useMutation({
    // Empty password on edit = keep the current one
    mutationFn: () => saveStaff({ ...form, phone: form.phone || null, password: form.password || undefined }, user?.id),
    onSuccess: () => {
      toast.success(t("admin.common.saved"))
      qc.invalidateQueries({ queryKey: ["admin", "staff"] })
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
          <DialogTitle>{user ? t("admin.staff.edit") : t("admin.staff.add")}</DialogTitle>
          <DialogDescription>{t("admin.staff.linkHint")}</DialogDescription>
        </DialogHeader>
        <form
          id="staff-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          <TextField id="u-name" label={t("auth.name")} value={form.name} onChange={(e) => set("name", e.target.value)} error={errorFor(errors, "name")} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="u-email" type="email" dir="ltr" label={t("auth.email")} value={form.email} onChange={(e) => set("email", e.target.value)} error={errorFor(errors, "email")} required />
            <TextField id="u-phone" type="tel" dir="ltr" placeholder="05XXXXXXXX" label={t("auth.phone")} value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} error={errorFor(errors, "phone")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id="u-gender"
              label={t("patient.gender")}
              value={form.gender ?? ""}
              onChange={(e) => set("gender", (e.target.value || null) as StaffInput["gender"])}
              error={errorFor(errors, "gender")}
            >
              <option value="">—</option>
              <option value="male">{t("patient.male")}</option>
              <option value="female">{t("patient.female")}</option>
            </SelectField>
            <SelectField id="u-role" label={t("admin.staff.role")} value={form.role} onChange={(e) => set("role", e.target.value as StaffInput["role"])} error={errorFor(errors, "role")}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </SelectField>
            <TextField
              id="u-password"
              type="password"
              autoComplete="new-password"
              label={t("admin.staff.password")}
              hint={user ? t("admin.staff.passwordKeep") : undefined}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              error={errorFor(errors, "password")}
              required={!user}
            />
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium">
            {t("admin.common.active")}
            <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
          </label>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("admin.common.cancel")}
          </Button>
          <Button type="submit" form="staff-form" disabled={save.isPending} className="rounded-xl">
            {save.isPending && <Spinner />}
            {t("admin.common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminStaffPage() {
  const { t } = useLocale()
  const q = useQuery({ queryKey: ["admin", "staff"], queryFn: adminStaff })
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null)

  return (
    <>
      <PageHeader
        title={t("admin.staff.title")}
        subtitle={t("admin.staff.subtitle")}
        actions={
          <Button className="rounded-xl shadow-soft" onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden="true" />
            {t("admin.staff.add")}
          </Button>
        }
      />
      <Panel className="overflow-hidden">
        {q.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-5">{t("auth.name")}</TableHead>
                <TableHead>{t("auth.email")}</TableHead>
                <TableHead>{t("admin.staff.role")}</TableHead>
                <TableHead />
                <TableHead className="pe-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.map((u) => (
                <TableRow key={u.id} className={cn(!u.isActive && "opacity-60")}>
                  <TableCell className="ps-5">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {u.name.replace("د. ", "").split(" ").slice(0, 2).map((p) => p[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </TableCell>
                  <TableCell dir="ltr" className="text-start text-muted-foreground rtl:text-end">
                    {u.email}
                  </TableCell>
                  <TableCell>{t(`roles.${u.role}`)}</TableCell>
                  <TableCell>
                    <ActiveBadge active={u.isActive} />
                  </TableCell>
                  <TableCell className="pe-5 text-end">
                    <Button size="icon-sm" variant="ghost" aria-label={t("admin.common.edit")} onClick={() => setEditing(u)}>
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
      {editing && <StaffDialog user={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
