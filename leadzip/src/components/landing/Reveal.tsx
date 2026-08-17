'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * Scroll-triggered reveal with spring physics (natural, weighted entrance —
 * not a linear fade). Content is always in the DOM for SEO; motion only
 * affects opacity/transform.
 *
 * Framer Motion drives this spring itself (not a CSS `transition`), so the
 * blanket `prefers-reduced-motion` rule in globals.css cannot touch it —
 * that rule only mutes native CSS transitions/animations. useReducedMotion()
 * is the actual off switch, the same one HeroMap, ChatWidget, and PromoPopup
 * already use.
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: 'spring', mass: 1, stiffness: 120, damping: 18, delay }
      }
    >
      {children}
    </motion.div>
  )
}
