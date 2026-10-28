import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import type { Gender, Role } from "@/lib/types"

/*
 * Flat illustrated avatars, one per role × gender, drawn on a 40×40 grid.
 * Layer order: tinted ground → neck → clothing → head covering / face → hair & props.
 * Without a gender we fall back to the person's initials (an admin gets the clinic building).
 */

const SKIN = "#E2AE84"
const HAIR = "#2A2522"
const INK = "#273444"

const GROUND: Record<Role, string> = {
  doctor: "#CDEBE8",
  receptionist: "#D6E6F7",
  admin: "#E3DDF3",
  patient: "#F6E3D2",
}

const Neck = () => <rect x="17.4" y="20" width="5.2" height="8" rx="2.2" fill={SKIN} />
const Face = () => <ellipse cx="20" cy="16.4" rx="6" ry="6.6" fill={SKIN} />
const Body = ({ fill }: { fill: string }) => <path d="M5 40c0-8.4 6.6-12.6 15-12.6S35 31.6 35 40Z" fill={fill} />
const ShortHair = () => (
  <path d="M13.9 15.6c-.6-5.4 2.3-8.1 6.1-8.1 4.1 0 7 2.6 6.2 8.2-.9-2.4-2.9-3.6-6.2-3.6-3.2 0-5.2 1.1-6.1 3.5Z" fill={HAIR} />
)
const Hijab = ({ fill }: { fill: string }) => (
  <path d="M20 7.2c-5.9 0-8.6 4.4-8.6 9.4 0 4.6 1.5 7.8 3.5 10.6h10.2c2-2.8 3.5-6 3.5-10.6 0-5-2.7-9.4-8.6-9.4Z" fill={fill} />
)
const HijabFace = () => <ellipse cx="20" cy="16.8" rx="5.2" ry="6" fill={SKIN} />

/** White coat over teal scrubs, with a stethoscope. */
const Coat = () => (
  <>
    <Body fill="#FFFFFF" />
    <path d="M16.2 27.6 20 33.6l3.8-6Z" fill="#0E7490" />
    <path d="M16.2 27.6 18.6 40M23.8 27.6 21.4 40" stroke="#D3DDE3" strokeWidth=".8" fill="none" />
    <path d="M15.2 28.4c-1.2 3.4-.4 6.6 2.4 7.2M24.8 28.4c1.1 2.6.9 4.6-.4 6" stroke={INK} strokeWidth="1" fill="none" strokeLinecap="round" />
    <circle cx="24.2" cy="35.2" r="1.3" fill={INK} />
  </>
)

/** Over-ear headset with a boom mic. */
const Headset = () => (
  <>
    <path d="M12.6 17c0-8.4 14.8-8.4 14.8 0" stroke={INK} strokeWidth="1.5" fill="none" />
    <rect x="11.2" y="15.2" width="2.8" height="4.4" rx="1.3" fill={INK} />
    <rect x="26" y="15.2" width="2.8" height="4.4" rx="1.3" fill={INK} />
    <path d="M12.8 19.6c.4 2.8 2.6 3.8 4.8 3.6" stroke={INK} strokeWidth="1.1" fill="none" strokeLinecap="round" />
    <circle cx="17.8" cy="23.2" r="1" fill={INK} />
  </>
)

/** Collared shirt in the brand teal. */
const Shirt = () => (
  <>
    <Body fill="#0E7490" />
    <path d="M17 27.6 20 31l3-3.4" stroke="#E6F4F6" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
  </>
)

/** Dark suit, white shirt, teal tie. */
const Suit = () => (
  <>
    <Body fill="#1F2A3A" />
    <path d="M16.6 27.6 20 35l3.4-7.4Z" fill="#F4F7FA" />
    <path d="M19.2 29h1.6l.6 5.2-1.4 1.6-1.4-1.6Z" fill="#0E7490" />
  </>
)

/** Patient: white thobe, ghutra with agal and a short beard. */
const Thobe = () => (
  <>
    <Body fill="#FBFBFA" />
    <path d="M20 27.6v6" stroke="#D9DCE0" strokeWidth=".9" />
    <path d="M20 6.8c-6.2 0-9 4.6-9 9.2L9.6 30.4l4.6-1.2c-.6-4.6-.5-7.8.2-10.6h11.2c.7 2.8.8 6 .2 10.6l4.6 1.2L29 16c0-4.6-2.8-9.2-9-9.2Z" fill="#FFFFFF" stroke="#D9DCE0" strokeWidth=".7" />
    <ellipse cx="20" cy="17" rx="5.4" ry="6.2" fill={SKIN} />
    <path d="M14.8 17.6c.4 4.8 2.8 6.4 5.2 6.4s4.8-1.6 5.2-6.4c-.9 2.6-2.8 3.6-5.2 3.6s-4.3-1-5.2-3.6Z" fill={HAIR} />
    <ellipse cx="20" cy="11" rx="7" ry="1.7" fill="none" stroke="#1C1C1C" strokeWidth="1.3" />
  </>
)

/** The center's own account (admin with no person behind it): the clinic building with the brand cross. */
const Clinic = () => (
  <>
    <rect x="9" y="13" width="22" height="27" rx="2.5" fill="#FFFFFF" />
    <rect x="9" y="13" width="22" height="5" rx="2.5" fill="#0E7490" />
    <path d="M18.6 20.5h2.8v2.6H24v2.8h-2.6v2.6h-2.8v-2.6H16v-2.8h2.6Z" fill="#0E7490" />
    <rect x="12" y="21" width="2.6" height="2.6" rx=".6" fill="#C9D3DC" />
    <rect x="25.4" y="21" width="2.6" height="2.6" rx=".6" fill="#C9D3DC" />
    <rect x="12" y="26.4" width="2.6" height="2.6" rx=".6" fill="#C9D3DC" />
    <rect x="25.4" y="26.4" width="2.6" height="2.6" rx=".6" fill="#C9D3DC" />
    <rect x="17.4" y="31" width="5.2" height="9" rx="1" fill={INK} />
  </>
)

function figure(role: Role, gender: Gender | null): ReactNode {
  if (!gender) return <Clinic />
  const female = gender === "female"
  switch (role) {
    case "doctor":
      return female ? (
        <>
          <Coat />
          <Hijab fill="#1E3A5F" />
          <HijabFace />
        </>
      ) : (
        <>
          <Neck />
          <Coat />
          <Face />
          <ShortHair />
        </>
      )
    case "receptionist":
      return female ? (
        <>
          <Shirt />
          <Hijab fill="#6B4F7A" />
          <HijabFace />
          <Headset />
        </>
      ) : (
        <>
          <Neck />
          <Shirt />
          <Face />
          <ShortHair />
          <Headset />
        </>
      )
    case "admin":
      return female ? (
        <>
          <Suit />
          <Hijab fill="#3B3F4A" />
          <HijabFace />
        </>
      ) : (
        <>
          <Neck />
          <Suit />
          <Face />
          <ShortHair />
        </>
      )
    case "patient":
      return female ? (
        <>
          <Body fill="#2F3A48" />
          <Hijab fill="#2F3A48" />
          <HijabFace />
        </>
      ) : (
        <Thobe />
      )
  }
}

export function UserAvatar({
  role,
  gender,
  name,
  className,
}: {
  role: Role
  gender?: Gender | null
  name: string
  className?: string
}) {
  // An admin account without a gender is the center itself: it gets the clinic illustration
  const art = gender ?? (role === "admin" ? null : undefined)
  if (art === undefined) {
    const initials = name.replace(/^(د\.|Dr\.?)\s*/, "").split(" ").slice(0, 2).map((p) => p[0]).join("")
    return (
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary", className)} aria-hidden="true">
        {initials}
      </span>
    )
  }
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8 shrink-0 rounded-full", className)} aria-hidden="true">
      <clipPath id={`ua-${role}-${art ?? "clinic"}`}>
        <circle cx="20" cy="20" r="20" />
      </clipPath>
      <g clipPath={`url(#ua-${role}-${art ?? "clinic"})`}>
        <rect width="40" height="40" fill={GROUND[role]} />
        {figure(role, art)}
      </g>
    </svg>
  )
}
