import { lazy, Suspense, type ReactNode } from "react"
import { createBrowserRouter, Link, Navigate, Outlet, useLocation } from "react-router"

import { AppLayout } from "@/components/layout/app-layout"
import { PublicLayout } from "@/components/layout/public-layout"
import { PulseLoader } from "@/components/shared/pulse-loader"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/i18n"
import type { Role } from "@/lib/types"
import { homeFor, useAuth } from "@/providers/auth"
import LandingPage from "@/pages/public/landing"

// Route-level code splitting keeps the landing page light
const BookPage = lazy(() => import("@/pages/booking/book-page"))
const MyAppointments = lazy(() => import("@/pages/patient/my-appointments"))
const StaffDashboard = lazy(() => import("@/pages/staff/dashboard"))
const DoctorCalendar = lazy(() => import("@/pages/doctor/calendar"))
const AdminReports = lazy(() => import("@/pages/admin/reports"))
const AdminDoctors = lazy(() => import("@/pages/admin/doctors"))
const AdminSpecialties = lazy(() => import("@/pages/admin/specialties"))
const AdminTimeOff = lazy(() => import("@/pages/admin/time-off"))
const AdminStaff = lazy(() => import("@/pages/admin/staff"))
const AdminSettings = lazy(() => import("@/pages/admin/settings"))
const LoginPage = lazy(() => import("@/pages/public/auth").then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import("@/pages/public/auth").then((m) => ({ default: m.RegisterPage })))
const ForgotPasswordPage = lazy(() => import("@/pages/public/auth").then((m) => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import("@/pages/public/auth").then((m) => ({ default: m.ResetPasswordPage })))
const VerifyEmailPage = lazy(() => import("@/pages/public/auth").then((m) => ({ default: m.VerifyEmailPage })))
const AdminRefunds = lazy(() => import("@/pages/admin/refunds"))

function Loading() {
  return (
    <div className="grid min-h-[50dvh] place-items-center">
      <PulseLoader delayed />
    </div>
  )
}

const page = (node: ReactNode) => <Suspense fallback={<Loading />}>{node}</Suspense>

function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />
  return <>{children}</>
}

/** Guests book from the public site; signed-in users book inside their console. */
function PublicBook() {
  const { user } = useAuth()
  const location = useLocation()
  if (user) return <Navigate to={`/new${location.search}`} replace />
  return page(<BookPage />)
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  if (user) return <Navigate to={from ?? homeFor(user.role)} replace />
  return page(children)
}

function NotFound() {
  const { t } = useLocale()
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 text-center">
      <div>
        <p className="text-7xl font-extrabold text-primary">404</p>
        <p className="mt-2 text-muted-foreground">{t("errors.not_found")}</p>
        <Button asChild className="mt-6">
          <Link to="/">{t("nav.home")}</Link>
        </Button>
      </div>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "book", element: <PublicBook /> },
      { path: "*", element: <NotFound /> },
    ],
  },
  { path: "login", element: <GuestOnly><LoginPage /></GuestOnly> },
  { path: "register", element: <GuestOnly><RegisterPage /></GuestOnly> },
  { path: "forgot-password", element: <GuestOnly><ForgotPasswordPage /></GuestOnly> },
  { path: "reset-password", element: <GuestOnly><ResetPasswordPage /></GuestOnly> },
  // Works signed in or out: the link opens from the patient's inbox
  { path: "verify-email", element: page(<VerifyEmailPage />) },
  {
    element: (
      <RequireRole>
        <AppLayout />
      </RequireRole>
    ),
    children: [
      { path: "new", element: page(<BookPage />) },
      { path: "my", element: <RequireRole roles={["patient"]}>{page(<MyAppointments />)}</RequireRole> },
      { path: "staff", element: <RequireRole roles={["receptionist", "admin"]}>{page(<StaffDashboard />)}</RequireRole> },
      { path: "doctor", element: <RequireRole roles={["doctor"]}>{page(<DoctorCalendar />)}</RequireRole> },
      {
        path: "admin",
        element: <RequireRole roles={["admin"]}><Outlet /></RequireRole>,
        children: [
          { index: true, element: page(<AdminReports />) },
          { path: "doctors", element: page(<AdminDoctors />) },
          { path: "specialties", element: page(<AdminSpecialties />) },
          { path: "time-off", element: page(<AdminTimeOff />) },
          { path: "staff", element: page(<AdminStaff />) },
          { path: "settings", element: page(<AdminSettings />) },
          { path: "refunds", element: page(<AdminRefunds />) },
        ],
      },
    ],
  },
])
