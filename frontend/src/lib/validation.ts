import { z } from "zod"

/** Messages are i18n keys; <FormField> translates them. */
/** Saudi mobile, local format 05XXXXXXXX */
export const phoneSchema = z.string().trim().regex(/^05\d{8}$/, "errors.phone")
/** National ID (1…) or Iqama (2…), optional */
export const nationalIdSchema = z
  .string()
  .trim()
  .regex(/^([12]\d{9})?$/, "errors.nationalId")
  .optional()
export const emailSchema = z.string().trim().min(1, "errors.required").email("errors.email")

export const patientSchema = z.object({
  name: z.string().trim().min(3, "errors.required"),
  email: emailSchema,
  phone: phoneSchema,
  nationalId: nationalIdSchema,
  birthDate: z
    .string()
    .min(1, "errors.required")
    .refine((v) => {
      const d = new Date(v)
      return !Number.isNaN(d.getTime()) && d < new Date() && d.getFullYear() > 1900
    }, "errors.birthDate"),
  gender: z.enum(["male", "female"], { message: "errors.required" }),
})
export type PatientForm = z.infer<typeof patientSchema>

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "errors.password"),
})
export type LoginForm = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  name: z.string().trim().min(3, "errors.required"),
  email: emailSchema,
  phone: phoneSchema,
  password: z.string().min(8, "errors.password"),
  gender: z.enum(["male", "female"], { message: "errors.required" }),
})
export type RegisterForm = z.infer<typeof registerSchema>
