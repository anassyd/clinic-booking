/**
 * Client for the Laravel API (backend/routes/api.php).
 *
 * Function names match the old in-browser mock so pages stay the same. The catalog
 * (specialties + doctors) is loaded once at boot and read synchronously; patients and
 * appointments seen in responses are cached so lists can resolve names without extra calls.
 */
import { addMinutes, differenceInYears, format, isBefore, parse } from "date-fns"

import { ApiError, http, tokenStore } from "./http"
import type { Appointment, DayAvailability, DeskPayment, Doctor, Gender, Patient, PaymentMethod, Slot, Specialty, StaffNotification, User } from "./types"

export { ApiError }

/** Mirrors backend config/clinic.php for UI hints; the server enforces the real values. */
export const SETTINGS = {
  slotMinutes: 30,
  maxBookingDaysAhead: 30,
} as const

type Data<T> = { data: T }

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

export function buildSlots(start: string, end: string): Omit<Slot, "available">[] {
  const base = new Date(2000, 0, 1)
  let cursor = parse(start, "HH:mm", base)
  const stop = parse(end, "HH:mm", base)
  const out: Omit<Slot, "available">[] = []
  while (isBefore(cursor, stop)) {
    const next = addMinutes(cursor, SETTINGS.slotMinutes)
    out.push({ start: format(cursor, "HH:mm"), end: format(next, "HH:mm") })
    cursor = next
  }
  return out
}

export const toDateTime = (date: string, time: string) => parse(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date())

export const ageOf = (birthDate: string) => differenceInYears(new Date(), parse(birthDate, "yyyy-MM-dd", new Date()))

/* ------------------------------------------------------------------ */
/* Caches                                                              */
/* ------------------------------------------------------------------ */

let specialties: Specialty[] = []
let doctors: Doctor[] = []
const patients = new Map<number, Patient>()
const appointments = new Map<number, Appointment>()

const remember = <T extends Appointment | Appointment[]>(value: T): T => {
  for (const a of Array.isArray(value) ? value : [value]) {
    appointments.set(a.id, a)
    if (a.patient) patients.set(a.patient.id, a.patient)
  }
  return value
}

const rememberPatients = (list: Patient[]) => {
  list.forEach((p) => patients.set(p.id, p))
  return list
}

/** GET /specialties + /doctors — awaited in main.tsx before the first render. */
export async function loadCatalog() {
  const [s, d] = await Promise.all([http<Data<Specialty[]>>("GET", "/specialties"), http<Data<Doctor[]>>("GET", "/doctors")])
  specialties = s.data
  doctors = d.data
}

export const catalog = () => ({ specialties, doctors })
export const getDoctorSync = (id: number) => doctors.find((d) => d.id === id)
export const getSpecialtySync = (id: number) => specialties.find((s) => s.id === id)
export const getPatientSync = (id: number) => patients.get(id)

/** Patients with an open consultation on `date` among appointments seen so far (one-per-day rule hint). */
export const busyPatientsOn = (date: string) =>
  new Set(
    [...appointments.values()]
      .filter((a) => a.date === date && a.type === "consultation" && ["held", "pending", "confirmed"].includes(a.status))
      .map((a) => a.patientId),
  )

export const canPatientModify = (a: Appointment) => a.canModify ?? false

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

type AuthResponse = { token: string; user: User }

export async function login(email: string, password: string): Promise<User> {
  const res = await http<AuthResponse>("POST", "/auth/login", { body: { email, password } })
  tokenStore.set(res.token)
  return res.user
}

export async function register(input: { name: string; email: string; phone: string; password: string; gender: Gender }): Promise<User> {
  const res = await http<AuthResponse>("POST", "/auth/register", { body: input })
  tokenStore.set(res.token)
  return res.user
}

export async function logout() {
  try {
    await http("POST", "/auth/logout")
  } finally {
    tokenStore.set(null)
    patients.clear()
    appointments.clear()
  }
}

export const getMe = () => http<Data<User>>("GET", "/me").then((r) => r.data)

export const resendVerification = () => http<{ sent: boolean }>("POST", "/auth/email/resend")

/** The emailed link carries the API's relative signed path; resolve it against the API origin. */
export async function verifyEmail(path: string) {
  const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api/v1"
  const origin = new URL(base, window.location.origin).origin
  if (!path.startsWith("/api/")) throw new ApiError("invalid_verification_link", "", 400)
  const res = await fetch(origin + path, { headers: { Accept: "application/json" } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body.code ?? "invalid_verification_link", body.message ?? "", res.status)
  }
}

export const forgotPassword = (email: string) => http<{ sent: boolean }>("POST", "/auth/forgot-password", { body: { email } })

export const resetPassword = (input: { token: string; email: string; password: string; password_confirmation: string }) =>
  http<{ reset: boolean }>("POST", "/auth/reset-password", { body: input })

/* ------------------------------------------------------------------ */
/* Catalog & availability                                              */
/* ------------------------------------------------------------------ */

export const getSpecialties = async () => specialties

export const getDoctors = async (specialtyId?: number) =>
  specialtyId ? doctors.filter((d) => d.specialtyId === specialtyId) : doctors

// The server reads the role from the bearer token (staff see same-day slots)
export const getAvailability = (doctorId: number) =>
  http<Data<{ date: string; status: DayAvailability; free: number }[]>>("GET", `/doctors/${doctorId}/availability`).then((r) => r.data)

export const getSlots = (doctorId: number, date: string, ignoreId?: number) =>
  http<Data<Slot[]>>("GET", `/doctors/${doctorId}/slots`, { query: { date, ignore: ignoreId } }).then((r) => r.data)

/* ------------------------------------------------------------------ */
/* Patients                                                            */
/* ------------------------------------------------------------------ */

export type PatientInput = Omit<Patient, "id" | "userId" | "age">

const patientBody = (p: PatientInput) => ({
  name: p.name,
  email: p.email,
  phone: p.phone,
  national_id: p.nationalId || null,
  birth_date: p.birthDate,
  gender: p.gender,
})

export const getMyPatients = () => http<Data<Patient[]>>("GET", "/patients").then((r) => rememberPatients(r.data))

export const searchPatients = async (q: string) =>
  q.trim().length < 3
    ? []
    : http<Data<Patient[]>>("GET", "/patients/search", { query: { q: q.trim() } }).then((r) => rememberPatients(r.data))

export const createPatient = (input: PatientInput) =>
  http<Data<Patient>>("POST", "/patients", { body: patientBody(input) }).then((r) => rememberPatients([r.data])[0])

/* ------------------------------------------------------------------ */
/* Appointments                                                        */
/* ------------------------------------------------------------------ */

export interface BookInput {
  doctorId: number
  date: string
  start: string
  patientId: number
  paymentMethod: PaymentMethod
  /** Reception only: the patient pays at the desk now */
  payment?: DeskPayment
  /** Books the follow-up the doctor asked for on this earlier visit */
  followUpOf?: number
  notes?: string
}

/** POST /appointments — online bookings come back "held" with a gateway URL. */
export async function createAppointment(input: BookInput): Promise<{ appointment: Appointment; paymentUrl?: string }> {
  const res = await http<Data<Appointment> & { paymentUrl?: string }>("POST", "/appointments", {
    body: {
      doctor_id: input.doctorId,
      patient_id: input.patientId,
      date: input.date,
      start: input.start,
      payment_method: input.paymentMethod,
      payment: input.payment ? { method: input.payment.method, reference: input.payment.reference || null } : undefined,
      follow_up_of: input.followUpOf,
      notes: input.notes || null,
    },
  })
  return { appointment: remember(res.data), paymentUrl: res.paymentUrl }
}

/** POST /appointments/{id}/pay — a new checkout URL while the slot is still held. */
export const payAppointment = (id: number) => http<{ paymentUrl: string }>("POST", `/appointments/${id}/pay`).then((r) => r.paymentUrl)

export const getAppointment = (id: number) => http<Data<Appointment>>("GET", `/appointments/${id}`).then((r) => remember(r.data))

export const getMyAppointments = () => http<Data<Appointment[]>>("GET", "/appointments/my").then((r) => remember(r.data))

export const cancelAppointment = (id: number, reason?: string) =>
  http<Data<Appointment>>("PATCH", `/appointments/${id}/cancel`, { body: { reason: reason || null } }).then((r) => remember(r.data))

export const rescheduleAppointment = (id: number, date: string, start: string) =>
  http<Data<Appointment>>("PATCH", `/appointments/${id}/reschedule`, { body: { date, start } }).then((r) => remember(r.data))

export const confirmAppointment = (id: number) =>
  http<Data<Appointment>>("PATCH", `/staff/appointments/${id}/confirm`).then((r) => remember(r.data))

export const markPaid = (id: number, payment: DeskPayment) =>
  http<Data<Appointment>>("PATCH", `/staff/appointments/${id}/paid`, {
    body: { method: payment.method, reference: payment.reference || null },
  }).then((r) => remember(r.data))

export const markNoShow = (id: number, asDoctor = false) =>
  http<Data<Appointment>>("PATCH", `/${asDoctor ? "doctor" : "staff"}/appointments/${id}/no-show`).then((r) => remember(r.data))

/**
 * Doctor: finish the visit. A follow-up is either booked now (`start` given, `due` is its date)
 * or requested by `due`, for reception or the patient to book.
 */
export async function completeAppointment(id: number, followUp?: { due: string; start?: string; note?: string }) {
  const res = await http<{ data: Appointment; followUp: Appointment | null }>("PATCH", `/doctor/appointments/${id}/complete`, {
    body: followUp ? { follow_up: { due: followUp.due, start: followUp.start ?? null, note: followUp.note || null } } : {},
  })
  remember(res.data)
  if (res.followUp) remember(res.followUp)
  return { appointment: res.data, followUp: res.followUp ?? undefined }
}

/** Follow-ups the doctor asked for and nobody booked yet (reception: all; patient: their family's). */
export const getFollowUps = () => http<Data<Appointment[]>>("GET", "/follow-ups").then((r) => remember(r.data))

export const dismissFollowUp = (id: number) =>
  http<Data<Appointment>>("PATCH", `/staff/follow-ups/${id}/dismiss`).then((r) => remember(r.data))

/** Header bell: latest alerts + unread count. */
export const getNotifications = () =>
  http<{ data: StaffNotification[]; meta: { unread: number } }>("GET", "/notifications").then((r) => ({ items: r.data, unread: r.meta.unread }))

export const markNotificationRead = (id: string) => http("PATCH", `/notifications/${id}/read`)

export const markAllNotificationsRead = () => http("POST", "/notifications/read-all")

/** Booking page link for a follow-up request: same doctor and patient, straight to picking a time. */
export const followUpBookingPath = (a: Appointment) => {
  const doctor = getDoctorSync(a.doctorId)
  return `/new?specialty=${doctor?.specialtyId}&doctor=${a.doctorId}&patient=${a.patientId}&followUp=${a.id}`
}

/** Reception: whole center for a range. */
export const getStaffAppointments = (from: string, to: string) =>
  http<Data<Appointment[]>>("GET", "/staff/appointments", { query: { from, to } }).then((r) => remember(r.data))

/** Reception: every appointment of one patient (search result details). */
export const getPatientAppointments = (patientId: number) =>
  http<Data<Appointment[]>>("GET", "/staff/appointments", { query: { patient_id: patientId } }).then((r) => remember(r.data))

/** Reception: confirmation queue, soonest to auto-cancel first. */
export const getPendingAppointments = () => http<Data<Appointment[]>>("GET", "/staff/pending").then((r) => remember(r.data))

/** Doctor: own schedule for a range. */
export const getDoctorAppointments = (from: string, to: string) =>
  http<Data<Appointment[]>>("GET", "/doctor/appointments", { query: { from, to } }).then((r) => remember(r.data))
