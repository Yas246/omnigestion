import { Fraunces, Manrope, Cormorant_Garamond, Jost } from 'next/font/google'

/**
 * Distinctive font pairings for the storefront templates (avoids generic
 * Inter/Roboto). Loaded once, exposed as CSS variables applied by the renderer.
 *
 *  Minimal  → Fraunces (display) + Manrope (body)      — editorial gallery
 *  Boutique → Cormorant Garamond (display) + Jost (body) — fashion maison
 */
export const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})
export const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})
export const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})
export const jost = Jost({
  subsets: ['latin'],
  variable: '--font-jost',
  display: 'swap',
})

/** Apply on the renderer wrapper so templates can use the --font-* variables. */
export const allFontsClass = `${fraunces.variable} ${manrope.variable} ${cormorant.variable} ${jost.variable}`
