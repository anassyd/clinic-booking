import { Check } from "lucide-react"
import { motion } from "motion/react"

import { useLocale } from "@/i18n"
import { cn } from "@/lib/utils"

export function Stepper({
  steps,
  current,
  onSelect,
}: {
  steps: string[]
  current: number
  onSelect: (index: number) => void
}) {
  const { num } = useLocale()
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center gap-2">
        {steps.map((label, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
              <button
                type="button"
                disabled={!done}
                onClick={() => onSelect(i)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group flex shrink-0 items-center gap-2 rounded-full text-sm font-medium transition-colors",
                  done ? "cursor-pointer" : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "relative grid size-9 place-items-center rounded-full border-2 text-sm font-semibold transition-colors duration-300",
                    done && "border-primary bg-primary text-primary-foreground group-hover:bg-primary/90",
                    active && "border-primary bg-primary/10 text-primary",
                    !done && !active && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden="true" /> : num(i + 1)}
                  {active && (
                    <motion.span
                      layoutId="stepper-ring"
                      className="absolute -inset-1 rounded-full ring-2 ring-primary/25"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </span>
                <span className={cn("hidden md:inline", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
              </button>
              {i < steps.length - 1 && (
                <span className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-border">
                  <motion.span
                    className="absolute inset-0 origin-[var(--o)] bg-primary [--o:left] rtl:[--o:right]"
                    initial={false}
                    animate={{ scaleX: done ? 1 : 0 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  />
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
