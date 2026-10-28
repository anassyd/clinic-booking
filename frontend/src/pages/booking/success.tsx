import { useRef } from "react"
import { Link } from "react-router"
import { useGSAP } from "@gsap/react"
import { parse } from "date-fns"
import gsap from "gsap"
import { CalendarDays, Clock, MessageCircle, Mail } from "lucide-react"

import { DoctorAvatar } from "@/components/shared/doctor-avatar"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/i18n"
import { getDoctorSync, getPatientSync } from "@/lib/api"
import type { Appointment } from "@/lib/types"
import { useAuth } from "@/providers/auth"

export function BookingSuccess({ appointment, onAgain }: { appointment: Appointment; onAgain: () => void }) {
  const { sep, t, tr, time, money, fdate, hijri } = useLocale()
  const { user } = useAuth()
  const root = useRef<HTMLDivElement>(null)
  const doctor = getDoctorSync(appointment.doctorId)!
  const patient = getPatientSync(appointment.patientId)
  const pending = appointment.status === "pending"

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
        tl.from(".ok-circle", { scale: 0, duration: 0.5, ease: "back.out(1.8)" })
          .fromTo(".ok-check", { strokeDashoffset: 40 }, { strokeDashoffset: 0, duration: 0.45 }, "-=0.1")
          .fromTo(".ok-ring", { scale: 0.6, opacity: 0.7 }, { scale: 1.8, opacity: 0, duration: 1.1, stagger: 0.25, ease: "power2.out" }, "-=0.4")
          .from(".ok-text > *", { y: 12, opacity: 0, duration: 0.45, stagger: 0.08 }, "-=1")
          .from(".ok-card", { y: 20, opacity: 0, duration: 0.5 }, "-=0.6")
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  return (
    <div ref={root} className="mx-auto max-w-lg px-4 py-12 text-center">
      <div className="relative mx-auto mb-8 grid size-24 place-items-center">
        <span className="ok-ring absolute inset-0 rounded-full bg-success/30" />
        <span className="ok-ring absolute inset-0 rounded-full bg-success/20" />
        <span className={`ok-circle relative grid size-24 place-items-center rounded-full ${pending ? "bg-warning" : "bg-success"} shadow-lift`}>
          <svg viewBox="0 0 24 24" className="size-12" aria-hidden="true">
            <path
              className="ok-check"
              d="M5 12.5l4.5 4.5L19 7.5"
              fill="none"
              stroke="white"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="40"
            />
          </svg>
        </span>
      </div>
      <div className="ok-text" role="status">
        <h1 className="text-3xl font-bold tracking-tight">{t("book.successTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{pending ? t("book.successPending") : t("book.successConfirmed")}</p>
      </div>

      <div className="ok-card mt-8 rounded-3xl border bg-card p-5 text-start shadow-soft">
        <div className="flex items-center gap-4">
          <DoctorAvatar doctor={doctor} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{tr(doctor.name)}</p>
            <p className="text-sm text-muted-foreground">{patient?.name}</p>
          </div>
          <StatusBadge status={appointment.status} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5">
            <CalendarDays className="size-4 text-primary" aria-hidden="true" />
            <span>
              {fdate(parse(appointment.date, "yyyy-MM-dd", new Date()), "EEEE d MMMM")}
              <span className="block text-xs text-muted-foreground">{hijri(parse(appointment.date, "yyyy-MM-dd", new Date()))}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5">
            <Clock className="size-4 text-primary" aria-hidden="true" />
            {time(appointment.start)}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm">
          <span className="flex items-center gap-3 text-muted-foreground">
            <MessageCircle className="size-4" aria-label="WhatsApp" />
            <Mail className="size-4" aria-label="Email" />
          </span>
          <span className="font-semibold tabular">
            {money(appointment.price)}{sep}{t(`payment.${appointment.paymentStatus}`)}
          </span>
        </div>
      </div>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        {user?.role === "patient" && (
          <Button asChild className="h-11 rounded-xl px-6">
            <Link to="/my">{t("book.viewAppointments")}</Link>
          </Button>
        )}
        <Button variant="outline" className="h-11 rounded-xl px-6" onClick={onAgain}>
          {t("book.bookAnother")}
        </Button>
      </div>
    </div>
  )
}
