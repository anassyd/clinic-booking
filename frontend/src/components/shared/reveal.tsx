import { motion, type HTMLMotionProps } from "motion/react"

/** Fade-and-rise when scrolled into view. Honors reduced motion via MotionConfig. */
export function Reveal({ delay = 0, y = 16, ...props }: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    />
  )
}
