import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cn("size-9", className)}>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--chart-2)" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#logo-g)" />
      <path
        d="M17 10h6v7h7v6h-7v7h-6v-7h-7v-6h7z"
        fill="var(--primary-foreground)"
        opacity="0.95"
      />
      <circle cx="29.5" cy="10.5" r="3" fill="var(--primary-foreground)" opacity="0.55" />
    </svg>
  )
}
