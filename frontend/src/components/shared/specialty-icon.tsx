import { Baby, Bone, HeartPulse, Sparkles, Stethoscope, type LucideIcon } from "lucide-react"

const ICONS: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  baby: Baby,
  "heart-pulse": HeartPulse,
  bone: Bone,
  sparkles: Sparkles,
}

export function SpecialtyIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Stethoscope
  return <Icon className={className} aria-hidden="true" />
}
