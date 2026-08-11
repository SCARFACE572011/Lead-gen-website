'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * Scroll-triggered reveal with spring physics (natural, weighted entrance —
 * not a linear fade). Respects reduced-motion via the CSS in globals.css, and
 * content is always in the DOM for SEO; motion only affects opacity/transform.
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
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ type: 'spring', mass: 1, stiffness: 120, damping: 18, delay }}
    >
      {children}
    </motion.div>
  )
}
