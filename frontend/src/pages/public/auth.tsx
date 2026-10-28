import { useEffect, useRef, useState, type ReactNode } from "react"
import { Controller, useForm } from "react-hook-form"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { useGSAP } from "@gsap/react"
import { useMutation } from "@tanstack/react-query"
import gsap from "gsap"
import {
  CalendarCheck2,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Lock,
  Mail,
  MailCheck,
  Phone,
  ShieldCheck,
  Stethoscope,
  User as UserIcon,
  UserRound,
} from "lucide-react"
import { motion } from "motion/react"
import { toast } from "sonner"

import { Brand } from "@/components/layout/public-layout"
import { FormField } from "@/components/shared/form-field"
import { LanguageToggle, ThemeToggle } from "@/components/shared/toggles"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useLocale } from "@/i18n"
import { forgotPassword, login, register, resetPassword, verifyEmail } from "@/lib/api"
import { errorMessage } from "@/lib/errors"
import type { Role, User } from "@/lib/types"
import { cn } from "@/lib/utils"
import { loginSchema, registerSchema, type LoginForm, type RegisterForm } from "@/lib/validation"
import { homeFor, useAuth } from "@/providers/auth"

/** Seeded by backend DemoSeeder (password "password"). Hidden in production builds unless VITE_SHOW_DEMO=true. */
const DEMO_ACCOUNTS: { email: string; role: Role }[] = [
  { email: "patient@demo.test", role: "patient" },
  { email: "staff@demo.test", role: "receptionist" },
  { email: "doctor@demo.test", role: "doctor" },
  { email: "admin@demo.test", role: "admin" },
]
const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO === "true"

const ROLE_ICONS: Record<Role, typeof UserRound> = {
  patient: UserRound,
  receptionist: ClipboardList,
  doctor: Stethoscope,
  admin: ShieldCheck,
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { t } = useLocale()
  const panel = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ delay: 0.2 })
          .from(".auth-chip", { y: 24, opacity: 0, duration: 0.7, stagger: 0.15, ease: "power3.out" })
          // Idle float starts only once the entrance is done, so the two never fight over `y`
          // Opposite directions and different periods, so the two chips never move in step
          .add(() => {
            gsap.to(".auth-chip-a", { y: -10, duration: 3.4, repeat: -1, yoyo: true, ease: "sine.inOut" })
            gsap.to(".auth-chip-b", { y: 10, duration: 4.2, repeat: -1, yoyo: true, ease: "sine.inOut" })
          })
      })
      return () => mm.revert()
    },
    { scope: panel },
  )

  return (
    // Desktop: exactly one screen tall; spacing tightens on short screens instead of scrolling
    <div className="grid min-h-dvh lg:h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-10 lg:overflow-y-auto lg:[scrollbar-width:none]">
        <div className="flex items-center justify-between">
          <Brand />
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 lg:py-[min(2.5rem,1.5vh)]"
        >
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
          <div className="mt-8 lg:mt-[min(2rem,3vh)]">{children}</div>
        </motion.div>
      </div>

      <div ref={panel} className="relative hidden overflow-hidden bg-primary lg:block">
        <div className="absolute inset-0 opacity-15 [background-image:radial-gradient(circle_at_1px_1px,var(--primary-foreground)_1px,transparent_0)] [background-size:26px_26px]" />
        <div className="absolute -end-32 -top-32 size-[28rem] rounded-full bg-chart-2/40 blur-3xl" />
        <div className="absolute -start-24 bottom-0 size-96 rounded-full bg-chart-3/40 blur-3xl" />
        <div className="relative flex h-full flex-col justify-end p-12 text-primary-foreground">
          <div className="mb-auto flex flex-col gap-[min(7rem,11vh)] pt-[min(6rem,9vh)]">
            <div className="auth-chip auth-chip-a ms-auto w-72 rounded-2xl bg-white/15 p-4 will-change-transform">
              <div className="flex items-center gap-3">
                <CalendarCheck2 className="size-5" aria-hidden="true" />
                <p className="font-semibold">{t("landing.confirmed")}</p>
              </div>
              <p className="mt-1 text-sm opacity-80">{t("landing.reminder")}</p>
            </div>
            <div className="auth-chip auth-chip-b ms-16 w-64 rounded-2xl bg-white/15 p-4 will-change-transform">
              <p className="text-sm opacity-80">{t("landing.nextSlot")}</p>
              <p className="mt-1 text-2xl font-bold">{t("landing.tomorrow")}</p>
            </div>
          </div>
          <h2 className="max-w-md text-3xl font-bold leading-tight">{t("auth.sidePanelTitle")}</h2>
          <p className="mt-3 max-w-md text-lg opacity-85">{t("auth.sidePanelBody")}</p>
        </div>
      </div>
    </div>
  )
}

function useFinishSignIn() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  return (user: User) => {
    signIn(user)
    navigate(from ?? homeFor(user.role), { replace: true })
  }
}

export function LoginPage() {
  const { t } = useLocale()
  const finish = useFinishSignIn()
  const form = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } })
  const mutation = useMutation({
    mutationFn: (v: LoginForm) => login(v.email, v.password),
    onSuccess: finish,
    onError: (e) => toast.error(errorMessage(t, e)),
  })
  const errors = form.formState.errors

  return (
    <AuthShell title={t("auth.loginTitle")} subtitle={t("auth.loginSubtitle")}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
        <FormField
          id="email"
          type="email"
          autoComplete="email"
          label={t("auth.email")}
          icon={<Mail className="size-4" />}
          error={errors.email}
          {...form.register("email")}
        />
        <FormField
          id="password"
          type="password"
          autoComplete="current-password"
          label={t("auth.password")}
          icon={<Lock className="size-4" />}
          error={errors.password}
          {...form.register("password")}
        />
        <div className="-mt-1 text-end">
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            {t("auth.forgot")}
          </Link>
        </div>
        <Button type="submit" className="h-11 w-full rounded-xl text-base" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner />}
          {t("auth.submitLogin")}
        </Button>
      </form>

      {SHOW_DEMO && (
      <div className="mt-8 rounded-2xl border bg-muted/40 p-4 lg:mt-[min(2rem,3vh)]">
        <p className="text-sm font-semibold">{t("auth.demo")}</p>
        <p className="text-xs text-muted-foreground">{t("auth.demoHint")}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((u) => {
            const Icon = ROLE_ICONS[u.role]
            return (
              <motion.button
                key={u.email}
                type="button"
                whileTap={{ scale: 0.97 }}
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ email: u.email, password: "password" })}
                className="flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-start text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <Icon className="size-4 text-primary" aria-hidden="true" />
                {t(`roles.${u.role}`)}
              </motion.button>
            )
          })}
        </div>
      </div>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground lg:mt-[min(1.5rem,2vh)]">
        {t("auth.noAccount")}{" "}
        <Link to="/register" className="font-semibold text-primary hover:underline">
          {t("nav.register")}
        </Link>
      </p>
    </AuthShell>
  )
}

export function RegisterPage() {
  const { t } = useLocale()
  const finish = useFinishSignIn()
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", phone: "", password: "", gender: undefined },
  })
  const mutation = useMutation({
    mutationFn: register,
    onSuccess: (user) => {
      toast.success(t("auth.registered"))
      finish(user)
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  })
  const errors = form.formState.errors

  return (
    <AuthShell title={t("auth.registerTitle")} subtitle={t("auth.registerSubtitle")}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
        <FormField id="name" autoComplete="name" label={t("auth.name")} icon={<UserIcon className="size-4" />} error={errors.name} {...form.register("name")} />
        <FormField id="email" type="email" autoComplete="email" label={t("auth.email")} icon={<Mail className="size-4" />} error={errors.email} {...form.register("email")} />
        <FormField
          id="phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          placeholder="05XXXXXXXX"
          label={t("auth.phone")}
          icon={<Phone className="size-4" />}
          error={errors.phone}
          {...form.register("phone")}
        />
        <FormField
          id="password"
          type="password"
          autoComplete="new-password"
          label={t("auth.password")}
          icon={<Lock className="size-4" />}
          error={errors.password}
          {...form.register("password")}
        />
        <Controller
          control={form.control}
          name="gender"
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              <p id="reg-gender" className="text-sm font-medium">
                {t("patient.gender")}
              </p>
              <div role="radiogroup" aria-labelledby="reg-gender" className="grid grid-cols-2 gap-2">
                {(["male", "female"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={field.value === g}
                    onClick={() => field.onChange(g)}
                    className={cn(
                      "h-11 cursor-pointer rounded-xl border text-sm font-medium transition-colors",
                      field.value === g ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "hover:bg-muted",
                    )}
                  >
                    {t(`patient.${g}`)}
                  </button>
                ))}
              </div>
              {fieldState.error?.message && <p className="text-xs text-destructive">{t(fieldState.error.message)}</p>}
            </div>
          )}
        />
        <Button type="submit" className="h-11 w-full rounded-xl text-base" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner />}
          {t("auth.submitRegister")}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          {t("nav.login")}
        </Link>
      </p>
    </AuthShell>
  )
}

/** Status card used by the verify / reset result screens. */
function Notice({ tone, children }: { tone: "ok" | "error" | "info"; children: ReactNode }) {
  const Icon = tone === "ok" ? CircleCheck : tone === "error" ? CircleAlert : MailCheck
  return (
    <div
      role="status"
      className={
        tone === "ok"
          ? "flex items-start gap-3 rounded-2xl bg-success/10 p-4 text-sm text-success"
          : tone === "error"
            ? "flex items-start gap-3 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive"
            : "flex items-start gap-3 rounded-2xl bg-primary/10 p-4 text-sm text-primary"
      }
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p className="font-medium">{children}</p>
    </div>
  )
}

export function ForgotPasswordPage() {
  const { t } = useLocale()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const mutation = useMutation({
    mutationFn: () => forgotPassword(email),
    onSuccess: () => setSent(true),
    onError: (e) => toast.error(errorMessage(t, e)),
  })

  return (
    <AuthShell title={t("auth.forgotTitle")} subtitle={t("auth.forgotSubtitle")}>
      {sent ? (
        <Notice tone="info">{t("auth.forgotSent")}</Notice>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            mutation.mutate()
          }}
        >
          <FormField id="email" type="email" autoComplete="email" required label={t("auth.email")} icon={<Mail className="size-4" />} value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" className="h-11 w-full rounded-xl text-base" disabled={mutation.isPending || !email}>
            {mutation.isPending && <Spinner />}
            {t("auth.forgotSubmit")}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="font-semibold text-primary hover:underline">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </AuthShell>
  )
}

export function ResetPasswordPage() {
  const { t } = useLocale()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const mismatch = confirm.length > 0 && password !== confirm
  const mutation = useMutation({
    mutationFn: () =>
      resetPassword({ token: params.get("token") ?? "", email: params.get("email") ?? "", password, password_confirmation: confirm }),
    onSuccess: () => {
      toast.success(t("auth.resetDone"))
      navigate("/login", { replace: true })
    },
    onError: (e) => toast.error(errorMessage(t, e)),
  })

  return (
    <AuthShell title={t("auth.resetTitle")} subtitle={t("auth.resetSubtitle")}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!mismatch) mutation.mutate()
        }}
      >
        <FormField id="new-password" type="password" autoComplete="new-password" minLength={8} required label={t("auth.newPassword")} icon={<Lock className="size-4" />} value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormField
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          label={t("auth.confirmPassword")}
          icon={<Lock className="size-4" />}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? { type: "validate", message: "auth.passwordsMismatch" } : undefined}
        />
        <Button type="submit" className="h-11 w-full rounded-xl text-base" disabled={mutation.isPending || password.length < 8 || mismatch}>
          {mutation.isPending && <Spinner />}
          {t("auth.resetSubmit")}
        </Button>
      </form>
    </AuthShell>
  )
}

export function VerifyEmailPage() {
  const { t } = useLocale()
  const [params] = useSearchParams()
  const { user, signIn } = useAuth()
  const [state, setState] = useState<"pending" | "ok" | "error">("pending")

  useEffect(() => {
    let cancelled = false
    verifyEmail(params.get("path") ?? "")
      .then(() => {
        if (cancelled) return
        setState("ok")
        if (user) signIn({ ...user, emailVerified: true })
      })
      .catch(() => !cancelled && setState("error"))
    return () => {
      cancelled = true
    }
    // Run once per link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  return (
    <AuthShell title={t("auth.verifyTitle")} subtitle="">
      {state === "pending" && (
        <p className="flex items-center gap-2 text-muted-foreground" role="status">
          <Spinner /> {t("auth.verifying")}
        </p>
      )}
      {state === "ok" && <Notice tone="ok">{t("auth.verified")}</Notice>}
      {state === "error" && <Notice tone="error">{t("auth.verifyFailed")}</Notice>}
      {state !== "pending" && (
        <Button asChild className="mt-6 h-11 w-full rounded-xl">
          <Link to={user ? "/new" : "/login"}>{user ? t("nav.book") : t("nav.login")}</Link>
        </Button>
      )}
    </AuthShell>
  )
}
