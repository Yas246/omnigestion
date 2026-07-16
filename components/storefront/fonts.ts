import {
  Fraunces,
  Manrope,
  Cormorant_Garamond,
  Jost,
  Archivo,
  DM_Sans,
  Syne,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Bricolage_Grotesque,
  Hanken_Grotesk,
} from 'next/font/google'

/**
 * Distinctive font pairings for the storefront templates (avoids generic
 * Inter/Roboto). Loaded once, exposed as CSS variables applied by the renderer.
 *
 *  Minimal  → Fraunces (display) + Manrope (body)          — editorial gallery
 *  Boutique → Cormorant Garamond (display) + Jost (body)   — fashion maison
 *  Marché   → Bricolage Grotesque (display) + Hanken (body)— warm greenmarket
 *  Studio   → Syne (display) + IBM Plex Sans (body)        — dark atelier
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

export const archivo = Archivo({ subsets: ['latin'], variable: '--font-archivo', display: 'swap' })
export const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' })
export const syne = Syne({ subsets: ['latin'], variable: '--font-syne', display: 'swap' })
export const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-plex-mono', display: 'swap' })
export const plexSans = IBM_Plex_Sans({ subsets: ['latin'], variable: '--font-plex-sans', display: 'swap' })

/** Marché — warm, characterful, slightly hand-crafted. */
export const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
})
/** Marché body — friendly, highly legible grotesque. */
export const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
})

/** Apply on the renderer wrapper so templates can use the --font-* variables. */
export const allFontsClass = `${fraunces.variable} ${manrope.variable} ${cormorant.variable} ${jost.variable} ${archivo.variable} ${dmSans.variable} ${syne.variable} ${plexMono.variable} ${plexSans.variable} ${bricolage.variable} ${hanken.variable}`
