import { cn } from "@/lib/utils"

/**
 * A chevron at rest that grows a shaft into a full arrow when its `group` parent is hovered or
 * focused (styles in index.css). Mirrored in RTL so it always points forward.
 */
export function HoverArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 10" className={cn("hover-arrow size-3", className)} aria-hidden="true">
      <path className="hover-arrow-shaft" d="M0 5h7" />
      <path className="hover-arrow-tip" d="M1 1l4 4-4 4" />
    </svg>
  )
}
