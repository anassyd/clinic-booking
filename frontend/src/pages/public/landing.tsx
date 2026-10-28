import { useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { useGSAP } from "@gsap/react"
import { addDays } from "date-fns"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import {
  BadgeCheck,
  BellRing,
  CalendarCheck2,
  CreditCard,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  Star,
  Stethoscope,
} from "lucide-react"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"

import { DoctorAvatar } from "@/components/shared/doctor-avatar"
import { HoverArrow } from "@/components/shared/hover-arrow"
import { Reveal } from "@/components/shared/reveal"
import { SpecialtyIcon } from "@/components/shared/specialty-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/i18n"
import { buildSlots, catalog } from "@/lib/api"
import { cn } from "@/lib/utils"

gsap.registerPlugin(ScrollTrigger, useGSAP)

function SectionHeading({ title, subtitle, id }: { title: string; subtitle: string; id?: string }) {
  return (
    <Reveal className="mx-auto mb-12 max-w-2xl text-center">
      <h2 id={id} className="text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-lg text-muted-foreground">{subtitle}</p>
    </Reveal>
  )
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function HeroVisual() {
  const { sep, t, tr, time, money, num, wday } = useLocale()
  const doctor = catalog().doctors[0]
  const days = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => addDays(new Date(), i + 1))
        .filter((d) => d.getDay() !== 5)
        .slice(0, 5),
    [],
  )
  const slots = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30"]

  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="hero-blob absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-primary/20 via-chart-3/10 to-chart-2/20 blur-2xl will-change-transform" />

      <div className="hero-card relative rounded-3xl border bg-card p-5 shadow-lift sm:p-6">
        <div className="flex items-center gap-4">
          <DoctorAvatar doctor={doctor} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{tr(doctor.name)}</p>
            <p className="truncate text-sm text-muted-foreground">{tr(doctor.title)}</p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-1 text-xs font-semibold">
            <Star className="size-3.5 fill-warning text-warning" aria-hidden="true" />
            {num(doctor.rating)}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-2">
          {days.map((d, i) => (
            <div
              key={i}
              className={cn(
                "hero-day rounded-2xl border px-1 py-2.5 text-center transition-colors",
                i === 0 ? "border-primary bg-primary text-primary-foreground shadow-soft" : "bg-background",
              )}
            >
              <p className={cn("text-[11px]", i === 0 ? "opacity-90" : "text-muted-foreground")}>
                {wday(d)}
              </p>
              <p className="tabular text-lg font-bold">{num(d.getDate())}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {slots.map((s, i) => (
            <div
              key={s}
              className={cn(
                "hero-slot rounded-xl border py-2 text-center text-sm font-medium tabular",
                i === 2 && "border-primary/50 bg-primary/10 text-primary ring-2 ring-primary/20",
                i === 4 && "text-muted-foreground line-through opacity-60",
              )}
            >
              {time(s)}
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("book.price")}</p>
            <p className="font-semibold tabular">{money(doctor.consultationPrice)}</p>
          </div>
          <div className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            {t("book.confirmCta")}
          </div>
        </div>
      </div>

      <div className="hero-float hero-float-a absolute -top-8 end-6 hidden items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-lift will-change-transform sm:flex">
        <span className="grid size-9 place-items-center rounded-xl bg-success/15 text-success">
          <BadgeCheck className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold">{t("landing.confirmed")}</p>
          <p className="text-xs text-muted-foreground">
            {t("landing.tomorrow")}{sep}{time("11:00")}
          </p>
        </div>
      </div>

      <div className="hero-float hero-float-b absolute start-6 -bottom-8 hidden items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-lift will-change-transform sm:flex">
        <span className="grid size-9 place-items-center rounded-xl bg-[#25D366]/15 text-[#128C4B] dark:text-[#25D366]">
          <MessageCircle className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold">WhatsApp</p>
          <p className="text-xs text-muted-foreground">{t("landing.reminder")}</p>
        </div>
      </div>
    </div>
  )
}

function Hero() {
  const { t, dir } = useLocale()
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
        tl.from(".hero-badge", { y: 12, opacity: 0, duration: 0.5 })
          .from(".hero-word", { yPercent: 110, opacity: 0, duration: 0.8, stagger: 0.06 }, "-=0.2")
          .from(".hero-sub", { y: 16, opacity: 0, duration: 0.6 }, "-=0.5")
          .from(".hero-cta", { y: 14, opacity: 0, duration: 0.5 }, "-=0.4")
          .from(".hero-card", { y: 40, opacity: 0, rotate: dir === "rtl" ? 2 : -2, duration: 0.9 }, 0.25)
          .from(".hero-day", { y: 10, opacity: 0, duration: 0.4, stagger: 0.05 }, "-=0.5")
          .from(".hero-slot", { scale: 0.9, opacity: 0, duration: 0.35, stagger: 0.04, ease: "back.out(1.6)" }, "-=0.3")
          .from(".hero-float-a", { y: -16, opacity: 0, duration: 0.6 }, "-=0.2")
          .from(".hero-float-b", { y: 16, opacity: 0, duration: 0.6 }, "-=0.4")
          // Idle float starts only once the entrance is done, so the two never fight over `y`
          .add(() => {
            gsap.to(".hero-float-a", { y: -8, duration: 3.2, repeat: -1, yoyo: true, ease: "sine.inOut" })
            gsap.to(".hero-float-b", { y: 8, duration: 3.6, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 0.4 })
          })
        gsap.to(".hero-blob", { scale: 1.06, rotate: 4, duration: 6, repeat: -1, yoyo: true, ease: "sine.inOut" })
      })
      return () => mm.revert()
    },
    { scope: root, dependencies: [dir], revertOnUpdate: true },
  )

  const words = (text: string, gradient = false) =>
    text.split(" ").map((w, i) => (
      // The mask clips the slide-in; the padding/negative-margin pair gives Arabic marks above the
      // letters (tanween, hamza) room inside it without changing the line layout
      <span key={i} className="-mt-[0.3em] inline-block overflow-hidden pt-[0.3em] pb-2 align-bottom">
        <span
          className={cn(
            "hero-word -mt-[0.3em] inline-block pt-[0.3em]",
            gradient && "bg-gradient-to-l from-primary to-chart-2 bg-clip-text text-transparent rtl:bg-gradient-to-r",
          )}
        >
          {w}&nbsp;
        </span>
      </span>
    ))

  return (
    <section ref={root} className="relative overflow-hidden">
      <div className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-2 lg:pt-20 lg:pb-28">
        <div className="text-center lg:text-start">
          <Badge variant="secondary" className="hero-badge mb-6 gap-1.5 rounded-full px-3 py-1 text-sm">
            <CalendarCheck2 className="size-4 text-primary" aria-hidden="true" />
            {t("landing.badge")}
          </Badge>
          <h1 className="text-4xl leading-[1.15] font-extrabold rtl:leading-[1.35] tracking-tight sm:text-5xl lg:text-6xl">
            <span className="block">{words(t("landing.title1"))}</span>
            <span className="block">{words(t("landing.title2"), true)}</span>
          </h1>
          <p className="hero-sub mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground lg:mx-0">
            {t("landing.subtitle")}
          </p>
          <div className="hero-cta mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Button asChild size="lg" className="group h-12 w-full rounded-xl px-6 text-base shadow-soft sm:w-auto">
              <Link to="/book">
                {t("landing.ctaPrimary")}
                <HoverArrow />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 w-full rounded-xl px-6 text-base sm:w-auto">
              <a href="#doctors">{t("landing.ctaSecondary")}</a>
            </Button>
          </div>
        </div>
        <HeroVisual />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

function Stats() {
  const { t, lang } = useLocale()
  const root = useRef<HTMLDivElement>(null)
  const { doctors, specialties } = catalog()
  // Daily capacity = slots in each doctor's working day
  const dailySlots = doctors.reduce((sum, d) => sum + (d.schedules[0] ? buildSlots(d.schedules[0].start, d.schedules[0].end).length : 0), 0)
  const items = [
    { value: doctors.length, label: t("landing.stats.doctors") },
    { value: specialties.length, label: t("landing.stats.specialties") },
    { value: dailySlots, label: t("landing.stats.slots") },
    { value: 6, label: t("landing.stats.days") },
  ]

  useGSAP(
    () => {
      const fmt = new Intl.NumberFormat(lang === "ar" ? "ar-SA" : "en-US")
      gsap.utils.toArray<HTMLElement>(".stat-value").forEach((el) => {
        const target = Number(el.dataset.value)
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        if (reduce) {
          el.textContent = fmt.format(target)
          return
        }
        const counter = { v: 0 }
        gsap.to(counter, {
          v: target,
          duration: 1.6,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
          onUpdate: () => {
            el.textContent = fmt.format(Math.round(counter.v))
          },
        })
      })
    },
    { scope: root, dependencies: [lang], revertOnUpdate: true },
  )

  return (
    <div ref={root} className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border bg-border shadow-soft md:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="bg-card px-6 py-7 text-center">
            <p className="stat-value tabular text-4xl font-extrabold text-primary" data-value={item.value}>
              0
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Specialties                                                         */
/* ------------------------------------------------------------------ */

function Specialties() {
  const { t, tr, num } = useLocale()
  const { specialties, doctors } = catalog()
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".spec-card", {
          opacity: 0,
          y: 24,
          scale: 0.96,
          duration: 0.5,
          stagger: { each: 0.08, grid: "auto" },
          ease: "back.out(1.4)",
          scrollTrigger: { trigger: ".spec-grid", start: "top 80%", once: true },
        })
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  return (
    <section ref={root} id="specialties" aria-labelledby="specialties-title" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading id="specialties-title" title={t("landing.specialtiesTitle")} subtitle={t("landing.specialtiesSubtitle")} />
        <div className="spec-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {specialties.map((s) => (
            // Hover lives on the wrapper, which never moves — the lifted card can't slip out from under the cursor and flicker
            <div key={s.id} className="spec-card group relative">
            {/* The shadow only fades in (cheap); animating box-shadow repaints every frame */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 shadow-lift transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1 group-hover:opacity-100"
            />
            <Link
              to={`/book?specialty=${s.id}`}
              className="relative flex h-full flex-col overflow-hidden rounded-3xl border bg-card p-6 transition-[translate,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:-translate-y-1 group-hover:border-primary/40 focus-visible:-translate-y-1"
            >
              <div className="absolute -end-8 -top-8 size-28 rounded-full bg-primary/5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-150" />
              <span className="relative grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                <SpecialtyIcon name={s.icon} className="size-6" />
              </span>
              <h3 className="relative mt-5 text-lg font-semibold">{tr(s.name)}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{tr(s.description)}</p>
              <p className="relative mt-auto pt-4 text-xs font-medium text-primary">
                {t("landing.doctorsCount", { n: num(doctors.filter((d) => d.specialtyId === s.id).length) })}
              </p>
            </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Doctors                                                             */
/* ------------------------------------------------------------------ */

function Doctors() {
  const { sep, t, tr, money, num } = useLocale()
  const { doctors, specialties } = catalog()
  const [active, setActive] = useState<number | null>(null)
  const list = active ? doctors.filter((d) => d.specialtyId === active) : doctors

  return (
    <section id="doctors" aria-labelledby="doctors-title" className="scroll-mt-20 bg-muted/40 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading id="doctors-title" title={t("landing.doctorsTitle")} subtitle={t("landing.doctorsSubtitle")} />

        <LayoutGroup>
          <div className="mb-10 flex flex-wrap justify-center gap-2" role="tablist">
            {[{ id: null as number | null, label: t("staff.allDoctors") }, ...specialties.map((s) => ({ id: s.id, label: tr(s.name) }))].map(
              (tab) => (
                <button
                  key={String(tab.id)}
                  role="tab"
                  aria-selected={active === tab.id}
                  onClick={() => setActive(tab.id)}
                  className={cn(
                    "relative cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    active === tab.id ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active === tab.id && (
                    <motion.span
                      layoutId="doctor-tab"
                      className="absolute inset-0 rounded-full bg-primary shadow-soft"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className="relative">{tab.label}</span>
                </button>
              ),
            )}
          </div>

          <motion.div layout className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {list.map((d) => {
                const spec = specialties.find((s) => s.id === d.specialtyId)!
                return (
                  <motion.article
                    layout
                    key={d.id}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ y: -4 }}
                    className="flex flex-col rounded-3xl border bg-card p-5 shadow-soft"
                  >
                    <div className="flex items-start gap-4">
                      <DoctorAvatar doctor={d} />
                      <div className="min-w-0">
                        <h3 className="font-semibold">{tr(d.name)}</h3>
                        <p className="text-sm text-muted-foreground">{tr(d.title)}</p>
                      </div>
                    </div>
                    <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">{tr(d.bio)}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                        <SpecialtyIcon name={spec.icon} className="size-3.5" />
                        {tr(spec.name)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 font-medium">
                        <Star className="size-3.5 fill-warning text-warning" aria-hidden="true" />
                        {num(d.rating)}
                      </span>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                        {t("book.experience", { n: num(d.yearsOfExperience) })}
                      </span>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-5">
                      <p className="text-sm">
                        <span className="text-muted-foreground">{t("book.price")}{sep}</span>
                        <span className="font-semibold tabular">{money(d.consultationPrice)}</span>
                      </p>
                      <Button asChild size="sm" variant="secondary" className="rounded-lg">
                        <Link to={`/book?specialty=${d.specialtyId}&doctor=${d.id}`}>{t("nav.book")}</Link>
                      </Button>
                    </div>
                  </motion.article>
                )
              })}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

function HowItWorks() {
  const { t, num } = useLocale()
  const root = useRef<HTMLElement>(null)
  const steps = t("landing.steps", { returnObjects: true }) as { title: string; body: string }[]
  const icons = [Stethoscope, CalendarCheck2, BellRing, CreditCard]

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference) and (min-width: 1024px)", () => {
        gsap.fromTo(
          ".how-line",
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: "none",
            scrollTrigger: { trigger: ".how-grid", start: "top 75%", end: "bottom 60%", scrub: 0.6 },
          },
        )
      })
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".how-step", {
          opacity: 0,
          y: 30,
          duration: 0.6,
          stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: { trigger: ".how-grid", start: "top 80%", once: true },
        })
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  return (
    <section ref={root} id="how" aria-labelledby="how-title" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading id="how-title" title={t("landing.howTitle")} subtitle={t("landing.howSubtitle")} />
        <div className="how-grid relative grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="absolute inset-x-[12%] top-8 hidden h-0.5 overflow-hidden rounded-full bg-border lg:block">
            <div className="how-line h-full origin-[var(--origin)] bg-gradient-to-r from-primary to-chart-2 [--origin:left] rtl:[--origin:right]" />
          </div>
          {steps.map((step, i) => {
            const Icon = icons[i]
            return (
              <div key={step.title} className="how-step relative text-center">
                <div className="relative mx-auto grid size-16 place-items-center rounded-2xl border bg-card shadow-soft">
                  <Icon className="size-7 text-primary" aria-hidden="true" />
                  <span className="absolute -end-2 -top-2 grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {num(i + 1)}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Features + CTA                                                      */
/* ------------------------------------------------------------------ */

function Features() {
  const { t } = useLocale()
  const features = t("landing.features", { returnObjects: true }) as { title: string; body: string }[]
  const icons = [MessageCircle, ShieldCheck, RotateCcw, CalendarCheck2]

  return (
    <section className="bg-muted/40 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading title={t("landing.featuresTitle")} subtitle={t("brand.tagline")} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => {
            const Icon = icons[i]
            return (
              <Reveal key={f.title} delay={i * 0.08} className="rounded-3xl border bg-card p-6">
                <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Cta() {
  const { t } = useLocale()
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-16 text-center text-primary-foreground sm:px-16">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:24px_24px]" />
          <div className="absolute -start-24 -top-24 size-72 rounded-full bg-chart-2/40 blur-3xl" />
          <div className="absolute -end-24 -bottom-24 size-72 rounded-full bg-chart-3/40 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.ctaTitle")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-lg opacity-90">{t("landing.ctaBody")}</p>
            <Button asChild size="lg" variant="secondary" className="group mt-8 h-12 rounded-xl px-7 text-base">
              <Link to="/book">
                {t("landing.ctaPrimary")}
                <HoverArrow />
              </Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Stats />
      <Specialties />
      <Doctors />
      <HowItWorks />
      <Features />
      <Cta />
    </>
  )
}
