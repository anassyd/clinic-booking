/** Admin endpoints (backend/routes/api.php → /admin/*). Payloads use the API's snake_case. */
import i18n from "i18next"

import { http, tokenStore } from "./http"
import { loadCatalog } from "./api"
import type { Appointment, Doctor, Gender, Role, Specialty, Translatable, User } from "./types"

type Data<T> = { data: T }

export interface AdminUser extends User {
  isActive: boolean
}

export interface TimeOff {
  id: number
  doctor_id: number | null
  date: string
  start_time: string | null
  end_time: string | null
  reason: string | null
}

export interface ReportRow {
  doctorId: number
  doctor: Translatable
  specialtyId: number
  specialty: Translatable
  booked: number
  completed: number
  noShow: number
  cancelled: number
  capacity: number
  occupancy: number
  noShowRate: number
  revenue: number
}

export interface Report {
  data: ReportRow[]
  totals: { booked: number; completed: number; noShow: number; cancelled: number; capacity: number; revenue: number }
}

export interface ClinicSettings {
  weekly_off_days: number[]
  min_booking_lead_hours: number
  max_booking_days_ahead: number
  edit_cancel_cutoff_hours: number
  pending_expiry_hours: number
  pending_expiry_before_appt_hours: number
  payment_hold_minutes: number
  max_pending_per_account: number
  max_active_per_patient_per_day: number
  reminder_before_hours: number
  vat_rate: number
}

/** Catalog edits also refresh the boot-time cache the public pages read. */
const thenRefresh = async <T,>(p: Promise<T>) => {
  const out = await p
  await loadCatalog()
  return out
}

/* Specialties */
export interface SpecialtyInput {
  slug: string
  name: Translatable
  description: Translatable | null
  icon: string
  is_active: boolean
}
export const adminSpecialties = () => http<Data<Specialty[]>>("GET", "/admin/specialties").then((r) => r.data)
export const saveSpecialty = (input: SpecialtyInput, id?: number) =>
  thenRefresh(http<Data<Specialty>>(id ? "PUT" : "POST", id ? `/admin/specialties/${id}` : "/admin/specialties", { body: input }))

/* Doctors */
export interface DoctorInput {
  specialty_id: number
  user_id: number | null
  name: Translatable
  title: Translatable | null
  bio: Translatable | null
  years_of_experience: number
  consultation_price: number
  follow_up_price: number
  is_active: boolean
}
export type AdminDoctor = Doctor & { userId?: number | null; isActive: boolean; specialty?: Specialty }
export const adminDoctors = () => http<Data<AdminDoctor[]>>("GET", "/admin/doctors").then((r) => r.data)
export const saveDoctor = (input: DoctorInput, id?: number) =>
  thenRefresh(http<Data<AdminDoctor>>(id ? "PUT" : "POST", id ? `/admin/doctors/${id}` : "/admin/doctors", { body: input }))

/** Returns bookings now outside working hours — never cancelled automatically. */
export const saveSchedule = (doctorId: number, schedules: { day_of_week: number; start: string; end: string }[]) =>
  thenRefresh(
    http<{ data: AdminDoctor; outsideSchedule: Appointment[] }>("PUT", `/admin/doctors/${doctorId}/schedules`, { body: { schedules } }),
  )

/* Time off */
export const adminTimeOff = (from?: string) => http<Data<TimeOff[]>>("GET", "/admin/time-off", { query: { from } }).then((r) => r.data)
export const createTimeOff = (input: {
  doctor_id: number | null
  date: string
  start: string | null
  end: string | null
  reason: string | null
  cancel_affected: boolean
}) => http<{ data: TimeOff; affected: Appointment[] }>("POST", "/admin/time-off", { body: input })
export const deleteTimeOff = (id: number) => http<void>("DELETE", `/admin/time-off/${id}`)

/* Staff */
export interface StaffInput {
  name: string
  email: string
  phone: string | null
  password?: string
  role: Exclude<Role, "patient">
  gender: Gender | null
  is_active: boolean
}
export const adminStaff = () => http<Data<AdminUser[]>>("GET", "/admin/staff").then((r) => r.data)
export const saveStaff = (input: StaffInput, id?: number) =>
  http<Data<AdminUser>>(id ? "PUT" : "POST", id ? `/admin/staff/${id}` : "/admin/staff", { body: input }).then((r) => r.data)

/* Settings & reports */
export const getSettings = () => http<Data<ClinicSettings>>("GET", "/admin/settings").then((r) => r.data)
export const saveSettings = (input: Partial<ClinicSettings>) =>
  http<Data<ClinicSettings>>("PUT", "/admin/settings", { body: input }).then((r) => r.data)
export const getReport = (from: string, to: string) => http<Report>("GET", "/admin/reports", { query: { from, to } })

/** GET /admin/reports?format=csv — needs the bearer token, so fetch a blob instead of a plain link. */
export async function downloadReportCsv(from: string, to: string) {
  const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api/v1"
  const res = await fetch(`${base}/admin/reports?from=${from}&to=${to}&format=csv`, {
    headers: { Authorization: `Bearer ${tokenStore.get()}`, "Accept-Language": i18n.language === "en" ? "en" : "ar" },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement("a"), { href: url, download: `report-${from}-${to}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}

export interface PendingRefund {
  id: number
  amount: number
  gateway: string
  error: string | null
  attempts: number
  failedAt: string | null
  appointment: Appointment
}
export const adminRefunds = () => http<Data<PendingRefund[]>>("GET", "/admin/refunds").then((r) => r.data)
export const retryRefund = (id: number) => http<{ ok: boolean; data: PendingRefund }>("POST", `/admin/refunds/${id}/retry`)
