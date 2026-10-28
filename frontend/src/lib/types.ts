export type Locale = "ar" | "en"
export type Translatable = Record<Locale, string>

export type Role = "patient" | "receptionist" | "doctor" | "admin"

export type Gender = "male" | "female"

export type AppointmentStatus =
  | "held"
  | "pending"
  | "confirmed"
  | "completed"
  | "no_show"
  | "cancelled"

export type AppointmentType = "consultation" | "follow_up"
/** "cash" from a patient means "at the clinic"; reception records the actual desk method when it collects */
export type PaymentMethod = "online" | "cash" | "card" | "transfer"
export type DeskMethod = Exclude<PaymentMethod, "online">
export interface DeskPayment {
  method: DeskMethod
  /** POS receipt (optional) or transfer number (required) */
  reference?: string
}
export type PaymentStatus = "unpaid" | "paid" | "refunded" | "refund_pending"

export interface User {
  id: number
  name: string
  email: string
  /** Picks the avatar illustration; null shows initials */
  gender?: Gender | null
  phone: string
  role: Role
  locale?: Locale
  doctorId?: number | null
  emailVerified?: boolean
}

export interface Specialty {
  id: number
  slug: string
  name: Translatable
  description: Translatable | null
  icon: string
  isActive?: boolean
  doctorsCount?: number
}

export interface DoctorSchedule {
  /** 0 = Sunday … 6 = Saturday (date-fns getDay) */
  dayOfWeek: number
  start: string // "09:00"
  end: string // "17:00"
}

export interface Doctor {
  id: number
  specialtyId: number
  name: Translatable
  title: Translatable
  bio: Translatable
  yearsOfExperience: number
  rating: number
  consultationPrice: number
  followUpPrice: number
  schedules: DoctorSchedule[]
}

export interface Patient {
  id: number
  userId?: number | null
  name: string
  email: string
  phone: string
  nationalId?: string | null
  birthDate: string // yyyy-MM-dd
  age?: number
  gender: Gender
}

export interface Appointment {
  id: number
  doctorId: number
  patientId: number
  parentId?: number
  type: AppointmentType
  date: string // yyyy-MM-dd
  start: string // HH:mm
  end: string
  status: AppointmentStatus
  price: number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  bookedBy: Role
  createdAt: string
  notes?: string | null
  cancelReason?: string | null
  /** Set on a finished visit when the doctor asked to see the patient again by this date (yyyy-MM-dd) */
  followUpDue?: string | null
  followUpNote?: string | null
  /** VAT contained in `price` (0 while VAT is disabled) */
  vatAmount?: number
  holdExpiresAt?: string | null
  pendingExpiresAt?: string | null
  /** Server decides whether the current user may still reschedule/cancel */
  canModify?: boolean
  patient?: Patient
}

export type StaffEvent = "new_pending" | "new_booking" | "cancelled" | "rescheduled" | "follow_up_requested"

/** A header-bell alert (reception / doctor) */
export interface StaffNotification {
  id: string
  event: StaffEvent
  data: {
    appointmentId: number
    patientId: number
    patient: string
    doctorId: number
    date: string
    start: string
    due?: string | null
    fromDate?: string
    fromStart?: string
  }
  readAt: string | null
  createdAt: string
}

export interface Slot {
  start: string
  end: string
  available: boolean
}

export type DayAvailability = "available" | "full" | "off" | "closed"
