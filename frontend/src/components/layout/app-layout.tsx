import { useEffect, useState } from "react"
import { Link, NavLink, useLocation, useNavigate, useOutlet } from "react-router"
import {
  BarChart3,
  CalendarDays,
  CalendarOff,
  CalendarPlus,
  ClipboardList,
  Home,
  Languages,
  LayoutDashboard,
  LogOut,
  MailWarning,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Settings2,
  Shapes,
  Stethoscope,
  Users,
} from "lucide-react"
import { useMutation } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { LanguageToggle, ThemeToggle } from "@/components/shared/toggles"
import { NotificationBell } from "@/components/layout/notification-bell"
import { UserAvatar } from "@/components/shared/user-avatar"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useLocale } from "@/i18n"
import { logout, resendVerification } from "@/lib/api"
import { errorMessage } from "@/lib/errors"
import type { Role } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAuth } from "@/providers/auth"

import { Brand } from "./public-layout"

const NAV: Record<Role, { to: string; key: string; icon: typeof Home }[]> = {
  patient: [
    { to: "/my", key: "nav.myAppointments", icon: ClipboardList },
    { to: "/book", key: "nav.book", icon: CalendarPlus },
  ],
  receptionist: [
    { to: "/staff", key: "nav.dashboard", icon: LayoutDashboard },
    { to: "/book", key: "staff.quickBook", icon: CalendarPlus },
  ],
  admin: [
    { to: "/admin", key: "admin.nav.reports", icon: BarChart3 },
    { to: "/admin/doctors", key: "admin.nav.doctors", icon: Stethoscope },
    { to: "/admin/specialties", key: "admin.nav.specialties", icon: Shapes },
    { to: "/admin/time-off", key: "admin.nav.timeOff", icon: CalendarOff },
    { to: "/admin/staff", key: "admin.nav.staff", icon: Users },
    { to: "/admin/settings", key: "admin.nav.settings", icon: Settings2 },
    { to: "/admin/refunds", key: "admin.nav.refunds", icon: RotateCcw },
    { to: "/staff", key: "admin.nav.reception", icon: LayoutDashboard },
    { to: "/new", key: "staff.quickBook", icon: CalendarPlus },
  ],
  doctor: [
    { to: "/doctor", key: "nav.calendar", icon: CalendarDays },
    { to: "/new", key: "nav.book", icon: CalendarPlus },
  ],
}

const SIDEBAR_KEY = "clinic-sidebar"

/** Desktop sidebar collapsed to icons; remembered per browser. */
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "collapsed"
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "expanded")
    } catch {
      /* private mode: just don't remember */
    }
  }, [collapsed])
  // Ctrl/Cmd + B toggles it, like most dashboards
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault()
        setCollapsed((c) => !c)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  return [collapsed, setCollapsed] as const
}

/** Shows the label as a tooltip only while the sidebar is collapsed to icons. */
function NavTip({ label, show, children }: { label: string; show: boolean; children: React.ReactElement }) {
  const { dir } = useLocale()
  if (!show) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={dir === "rtl" ? "left" : "right"}>{label}</TooltipContent>
    </Tooltip>
  )
}

function NavItems({ role, onNavigate, collapsed = false }: { role: Role; onNavigate?: () => void; collapsed?: boolean }) {
  const { t } = useLocale()
  // Labels fade rather than unmount, so the width animation never reflows the text
  const label = cn("relative whitespace-nowrap transition-opacity duration-200", collapsed && "opacity-0")
  return (
    <nav className="flex flex-col gap-1">
      {NAV[role].map((item) => (
        <NavTip key={item.to} label={t(item.key)} show={collapsed}>
        <NavLink
          to={item.to}
          end
          onClick={onNavigate}
          aria-label={collapsed ? t(item.key) : undefined}
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl bg-primary/10"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <item.icon className="relative size-4.5 shrink-0" aria-hidden="true" />
              <span className={label}>{t(item.key)}</span>
            </>
          )}
        </NavLink>
        </NavTip>
      ))}
      <NavTip label={t("nav.home")} show={collapsed}>
        <NavLink
          to="/"
          aria-label={collapsed ? t("nav.home") : undefined}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Home className="size-4.5 shrink-0" aria-hidden="true" />
          <span className={label}>{t("nav.home")}</span>
        </NavLink>
      </NavTip>
    </nav>
  )
}

/**
 * The exiting page keeps rendering during its exit animation. A plain <Outlet /> would
 * already resolve to the *next* route there, mounting the new page twice and dropping
 * anything typed into the first copy — so each page keeps the outlet it mounted with.
 */
/** Patients can't book until they confirm their email (FR-02). */
function VerifyEmailBanner() {
  const { t } = useLocale()
  const resend = useMutation({
    mutationFn: resendVerification,
    onSuccess: () => toast.success(t("auth.resent")),
    onError: (e) => toast.error(errorMessage(t, e)),
  })
  return (
    <div role="status" className="border-b bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5 text-sm sm:px-6">
        <MailWarning className="size-4 shrink-0" aria-hidden="true" />
        <p className="flex-1">{t("auth.verifyBanner")}</p>
        <Button size="sm" variant="outline" className="h-8 rounded-lg bg-transparent" disabled={resend.isPending || resend.isSuccess} onClick={() => resend.mutate()}>
          {resend.isPending && <Spinner />}
          {t("auth.resend")}
        </Button>
      </div>
    </div>
  )
}

function FrozenOutlet() {
  const outlet = useOutlet()
  const [frozen] = useState(outlet)
  return frozen
}

export function AppLayout() {
  const { t, dir, toggle } = useLocale()
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useSidebarCollapsed()
  if (!user) return null

  // The icon points the way the sidebar will move
  const ToggleIcon = dir === "rtl" ? (collapsed ? PanelRightOpen : PanelRightClose) : collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <div className="flex min-h-dvh bg-muted/30">
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col overflow-hidden border-e bg-sidebar p-4 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex",
          collapsed ? "w-[76px]" : "w-64",
        )}
      >
        {/* px-1 centers the 36px logo in the 76px rail; the name fades out as the rail narrows */}
        <Brand
          className={cn(
            "mb-8 px-1 whitespace-nowrap [&>span]:transition-opacity [&>span]:duration-200",
            collapsed && "[&>span]:opacity-0",
          )}
        />
        <NavItems role={user.role} collapsed={collapsed} />

        {/* Bottom: the role card (expanded only), then the collapse toggle styled like a nav row */}
        <div className="mt-auto flex flex-col gap-2">
          <div
            className={cn(
              "w-56 rounded-2xl border bg-card p-3 text-xs text-muted-foreground transition-opacity duration-200",
              collapsed && "hidden",
            )}
          >
            <p className="font-medium text-foreground">{t(`roles.${user.role}`)}</p>
            <p className="mt-0.5">{t("landing.hours")}</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t(collapsed ? "nav.expand" : "nav.collapse")}
                aria-expanded={!collapsed}
                onClick={() => setCollapsed((c) => !c)}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ToggleIcon className="size-4.5 shrink-0" aria-hidden="true" />
                <span className={cn("whitespace-nowrap transition-opacity duration-200", collapsed && "opacity-0")}>
                  {t("nav.collapse")}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side={dir === "rtl" ? "left" : "right"}>
              {t(collapsed ? "nav.expand" : "nav.collapse")} <kbd className="ms-1 font-sans opacity-70">Ctrl B</kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-lg sm:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("nav.menu")}>
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side={dir === "rtl" ? "right" : "left"} className="w-72 p-4">
              <SheetHeader className="p-0 pb-6">
                <SheetTitle className="sr-only">{t("nav.menu")}</SheetTitle>
                <Brand />
              </SheetHeader>
              <NavItems role={user.role} />
            </SheetContent>
          </Sheet>
          <Link to="/" className="font-semibold lg:hidden">
            {t("brand.short")}
          </Link>
          <div className="ms-auto flex items-center gap-1">
            <LanguageToggle className="hidden sm:inline-flex" />
            <ThemeToggle />
            {(user.role === "receptionist" || user.role === "doctor") && <NotificationBell />}
            <DropdownMenu dir={dir}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 gap-2 rounded-full ps-1 pe-3">
                  <UserAvatar role={user.role} gender={user.gender} name={user.name} />
                  <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs font-normal text-muted-foreground">{t(`roles.${user.role}`)}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="sm:hidden" onSelect={toggle}>
                  <Languages className="size-4" aria-hidden="true" />
                  {t("nav.language")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={async () => {
                    await logout().catch(() => undefined)
                    signOut()
                    navigate("/")
                  }}
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {user?.role === "patient" && user.emailVerified === false && <VerifyEmailBanner />}

        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            id="main"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
          >
            <FrozenOutlet />
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  )
}
