import type { Doctor } from "@/lib/types"
import { cn } from "@/lib/utils"

const TONES = [
  "from-primary/90 to-chart-3/80",
  "from-chart-2/90 to-primary/70",
  "from-chart-3/90 to-chart-2/70",
  "from-primary/80 to-chart-2/80",
  "from-chart-2/80 to-chart-3/90",
]

/** Monogram avatar — real photos come from the API later. */
export function DoctorAvatar({ doctor, className }: { doctor: Doctor; className?: string }) {
  const initials = doctor.name.en
    .replace(/^Dr\.\s*/, "")
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br text-lg font-semibold tracking-wide text-primary-foreground",
        TONES[doctor.id % TONES.length],
        className,
      )}
    >
      <span className="relative z-10">{initials}</span>
      <span className="absolute -end-3 -bottom-3 size-10 rounded-full bg-white/15" />
    </div>
  )
}
