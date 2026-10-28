import { useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus } from "lucide-react"
import { toast } from "sonner"

import { HoverArrow } from "@/components/shared/hover-arrow"
import { PageHeader } from "@/components/shared/page-header"
import { SpecialtyIcon } from "@/components/shared/specialty-icon"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { useLocale } from "@/i18n"
import { adminSpecialties, saveSpecialty, type SpecialtyInput } from "@/lib/admin-api"
import { errorMessage } from "@/lib/errors"
import type { Specialty } from "@/lib/types"
import { cn } from "@/lib/utils"

import { ActiveBadge, errorFor, serverErrors, TextField, type ServerErrors } from "./ui"

const ICONS = ["stethoscope", "baby", "heart-pulse", "bone", "sparkles"]

function SpecialtyDialog({ specialty, onClose }: { specialty?: Specialty; onClose: () => void }) {
  const { t } = useLocale()
  const qc = useQueryClient()
  const [form, setForm] = useState<SpecialtyInput>(() => ({
    slug: specialty?.slug ?? "",
    name: specialty?.name ?? { ar: "", en: "" },
    description: specialty?.description ?? { ar: "", en: "" },
    icon: specialty?.icon ?? "stethoscope",
    is_active: specialty?.isActive ?? true,
  }))
  const [errors, setErrors] = useState<ServerErrors>()
  const setT = (key: "name" | "description", lang: "ar" | "en", value: string) =>
    setForm((f) => ({ ...f, [key]: { ...(f[key] ?? { ar: "", en: "" }), [lang]: value } }))

  const save = useMutation({
    mutationFn: () => saveSpecialty(form, specialty?.id),
    onSuccess: () => {
      toast.success(t("admin.common.saved"))
      qc.invalidateQueries({ queryKey: ["admin", "specialties"] })
      onClose()
    },
    onError: (e) => {
      setErrors(serverErrors(e))
      toast.error(errorMessage(t, e))
    },
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{specialty ? t("admin.specialties.edit") : t("admin.specialties.add")}</DialogTitle>
        </DialogHeader>
        <form
          id="specialty-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          <TextField id="s-name-ar" dir="rtl" label={t("admin.common.nameAr")} value={form.name.ar} onChange={(e) => setT("name", "ar", e.target.value)} error={errorFor(errors, "name.ar")} required />
          <TextField id="s-name-en" dir="ltr" label={t("admin.common.nameEn")} value={form.name.en} onChange={(e) => setT("name", "en", e.target.value)} error={errorFor(errors, "name.en")} required />
          <TextField id="s-slug" dir="ltr" label={t("admin.specialties.slug")} hint={t("admin.specialties.slugHint")} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} error={errorFor(errors, "slug")} required />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("admin.specialties.icon")}</legend>
            <div className="flex gap-2" role="radiogroup">
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  role="radio"
                  aria-checked={form.icon === icon}
                  aria-label={icon}
                  onClick={() => setForm((f) => ({ ...f, icon }))}
                  className={cn(
                    "grid size-10 cursor-pointer place-items-center rounded-xl border transition-colors",
                    form.icon === icon ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "hover:bg-muted",
                  )}
                >
                  <SpecialtyIcon name={icon} className="size-5" />
                </button>
              ))}
            </div>
          </fieldset>
          <TextField id="s-desc-ar" multiline dir="rtl" label={t("admin.common.descAr")} value={form.description?.ar ?? ""} onChange={(e) => setT("description", "ar", e.target.value)} />
          <TextField id="s-desc-en" multiline dir="ltr" label={t("admin.common.descEn")} value={form.description?.en ?? ""} onChange={(e) => setT("description", "en", e.target.value)} />
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium sm:col-span-2">
            {t("admin.common.active")}
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
          </label>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("admin.common.cancel")}
          </Button>
          <Button type="submit" form="specialty-form" disabled={save.isPending} className="rounded-xl">
            {save.isPending && <Spinner />}
            {t("admin.common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminSpecialtiesPage() {
  const { t, tr, num } = useLocale()
  const q = useQuery({ queryKey: ["admin", "specialties"], queryFn: adminSpecialties })
  const [editing, setEditing] = useState<Specialty | "new" | null>(null)

  return (
    <>
      <PageHeader
        title={t("admin.specialties.title")}
        subtitle={t("admin.specialties.subtitle")}
        actions={
          <Button className="rounded-xl shadow-soft" onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden="true" />
            {t("admin.specialties.add")}
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {q.isLoading
          ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-40 rounded-3xl" />)
          : q.data?.map((s) => (
              // The title link stretches over the whole card (opens this specialty's doctors); the edit button sits above it
              <article
                key={s.id}
                className={cn(
                  "group relative rounded-3xl border bg-card p-5 shadow-soft transition-colors hover:border-primary/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring/50",
                  !s.isActive && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <SpecialtyIcon name={s.icon} className="size-6" />
                  </span>
                  <div className="relative z-10 flex items-center gap-2">
                    <ActiveBadge active={s.isActive ?? true} />
                    <Button size="icon-sm" variant="ghost" aria-label={t("admin.common.edit")} onClick={() => setEditing(s)}>
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                </div>
                <h2 className="mt-4 font-semibold">
                  <Link to={`/admin/doctors?specialty=${s.id}`} className="outline-none after:absolute after:inset-0 after:rounded-3xl">
                    {tr(s.name)}
                  </Link>
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{tr(s.description)}</p>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs font-medium">
                  <span className="text-primary">
                    {t("admin.specialties.doctors")}: {num(s.doctorsCount ?? 0)}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground transition-colors group-hover:text-primary">
                    {t("admin.specialties.manageDoctors")}
                    <HoverArrow />
                  </span>
                </div>
              </article>
            ))}
      </div>
      {editing && <SpecialtyDialog specialty={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
