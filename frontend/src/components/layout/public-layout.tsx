import { useEffect, useState } from "react"
import { Link, NavLink, Outlet } from "react-router"
import { CalendarPlus, LayoutDashboard, Menu } from "lucide-react"
import { motion } from "motion/react"

import { LogoMark } from "@/components/shared/logo"
import { LanguageToggle, ThemeToggle } from "@/components/shared/toggles"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useLocale } from "@/i18n"
import { cn } from "@/lib/utils"
import { homeFor, useAuth } from "@/providers/auth"

const SECTIONS = [
  { href: "/#specialties", key: "nav.specialties" },
  { href: "/#doctors", key: "nav.doctors" },
  { href: "/#how", key: "nav.how" },
] as const

export function Brand({ className }: { className?: string }) {
  const { t } = useLocale()
  return (
    <Link to="/" className={cn("flex items-center gap-2.5 rounded-lg", className)}>
      <LogoMark className="shrink-0" />
      <span className="leading-tight">
        <span className="block text-base font-bold tracking-tight">{t("brand.short")}</span>
        <span className="block text-[11px] text-muted-foreground">{t("brand.name")}</span>
      </span>
    </Link>
  )
}

function PublicHeader() {
  const { t, dir } = useLocale()
  const { user } = useAuth()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const account = user ? (
    <Button asChild variant="outline" size="sm">
      <Link to={homeFor(user.role)}>
        <LayoutDashboard className="size-4" aria-hidden="true" />
        {user.role === "patient" ? t("nav.myAppointments") : t("nav.dashboard")}
      </Link>
    </Button>
  ) : (
    <Button asChild variant="ghost" size="sm">
      <Link to="/login">{t("nav.login")}</Link>
    </Button>
  )

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300",
        scrolled
          ? "border-b bg-background/80 shadow-[0_1px_0_0_var(--border)] backdrop-blur-lg"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Brand />
        <nav className="hidden items-center gap-1 md:flex" aria-label={t("nav.menu")}>
          {SECTIONS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(s.key)}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-1 md:flex">
          <LanguageToggle />
          <ThemeToggle />
          {account}
          <Button asChild size="sm" className="ms-1">
            <Link to="/book">
              <CalendarPlus className="size-4" aria-hidden="true" />
              {t("nav.book")}
            </Link>
          </Button>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("nav.menu")}>
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side={dir === "rtl" ? "left" : "right"} className="w-72">
            <SheetHeader>
              <SheetTitle className="sr-only">{t("nav.menu")}</SheetTitle>
              <Brand />
            </SheetHeader>
            <div className="flex flex-col gap-1 px-4">
              {SECTIONS.map((s) => (
                <a key={s.href} href={s.href} className="rounded-md px-3 py-2.5 font-medium hover:bg-muted">
                  {t(s.key)}
                </a>
              ))}
              <div className="my-3 h-px bg-border" />
              {account}
              <Button asChild className="mt-2">
                <Link to="/book">{t("nav.book")}</Link>
              </Button>
              <div className="mt-4 flex items-center justify-between">
                <LanguageToggle />
                <ThemeToggle />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

function PublicFooter() {
  const { sep, t } = useLocale()
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Brand />
          <p className="text-sm text-muted-foreground">{t("landing.hours")}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {SECTIONS.map((s) => (
            <a key={s.href} href={s.href} className="hover:text-foreground">
              {t(s.key)}
            </a>
          ))}
          <NavLink to="/book" className="hover:text-foreground">
            {t("nav.book")}
          </NavLink>
        </nav>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} {t("brand.name")}{sep}{t("landing.footer")}
        </p>
      </div>
    </footer>
  )
}

export function PublicLayout() {
  const { t } = useLocale()
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t("nav.skip")}
      </a>
      <PublicHeader />
      <motion.main
        id="main"
        className="flex-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Outlet />
      </motion.main>
      <PublicFooter />
    </div>
  )
}
