import { cn } from "@/lib/utils"

import { LogoMark } from "./logo"

/** The ECG trace under the logo; pathLength=1 lets the CSS sweep work in fractions of the line. */
export const ECG_PATH = "M2 20H38L43 12L48 20H54L60 4L67 32L72 20H118"

/**
 * Brand loader: the logo beats while a heartbeat trace sweeps under it (styles in index.css).
 * `delayed` fades it in after 200 ms so fast loads never flash it.
 */
export function PulseLoader({ label, delayed, className }: { label?: string; delayed?: boolean; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("pulse-loader flex flex-col items-center gap-3", delayed && "pulse-loader-delayed", className)}>
      <LogoMark className="pulse-beat size-12" />
      <svg viewBox="0 0 120 36" className="h-7 w-24 overflow-visible" aria-hidden="true">
        <path d={ECG_PATH} pathLength={1} className="fill-none stroke-primary/15" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={ECG_PATH} pathLength={1} className="pulse-trace fill-none stroke-primary" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label ? <p className="text-sm font-medium text-muted-foreground">{label}</p> : <span className="sr-only">Loading…</span>}
    </div>
  )
}
