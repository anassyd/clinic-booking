import { useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

import { useLocale } from "@/i18n"

/** Animated number that tweens from its previous value with GSAP. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const { lang } = useLocale()
  const el = useRef<HTMLSpanElement>(null)
  const last = useRef(0)

  useGSAP(
    () => {
      const fmt = new Intl.NumberFormat(lang === "ar" ? "ar-SA" : "en-US")
      const node = el.current
      if (!node) return
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        node.textContent = fmt.format(value)
        last.current = value
        return
      }
      const counter = { v: last.current }
      gsap.to(counter, {
        v: value,
        duration: 1,
        ease: "power2.out",
        onUpdate: () => {
          node.textContent = fmt.format(Math.round(counter.v))
        },
        onComplete: () => {
          last.current = value
        },
      })
    },
    { dependencies: [value, lang] },
  )

  return (
    <span ref={el} className={className}>
      0
    </span>
  )
}
