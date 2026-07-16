/**
 * Single source of truth for storefront font pairings.
 *
 * Each template has a default pair; the merchant can override via
 * `config.fontPair` in the customizer. Every surface (renderer, product
 * detail, cart, preview) calls `resolveFonts(config)` so the override is
 * honoured everywhere — templates consume `--store-font-display` /
 * `--store-font-body` rather than hardcoding a specific family.
 */

export interface FontPair {
  display: string
  body: string
  label: string
}

export const FONT_PAIRS = {
  'fraunces-manrope': {
    display: 'var(--font-fraunces)',
    body: 'var(--font-manrope)',
    label: 'Fraunces + Manrope — Éditorial',
  },
  'cormorant-jost': {
    display: 'var(--font-cormorant)',
    body: 'var(--font-jost)',
    label: 'Cormorant + Jost — Maison',
  },
  'bricolage-hanken': {
    display: 'var(--font-bricolage)',
    body: 'var(--font-hanken)',
    label: 'Bricolage + Hanken — Chaleureux',
  },
  'syne-plex-sans': {
    display: 'var(--font-syne)',
    body: 'var(--font-plex-sans)',
    label: 'Syne + Plex Sans — Géométrique',
  },
  'archivo-dm-sans': {
    display: 'var(--font-archivo)',
    body: 'var(--font-dm-sans)',
    label: 'Archivo + DM Sans — Utilitaire',
  },
  'cormorant-hanken': {
    display: 'var(--font-cormorant)',
    body: 'var(--font-hanken)',
    label: 'Cormorant + Hanken — Luxe doux',
  },
  'fraunces-plex-sans': {
    display: 'var(--font-fraunces)',
    body: 'var(--font-plex-sans)',
    label: 'Fraunces + Plex Sans — Contraste',
  },
} as const satisfies Record<string, FontPair>

export type FontPairKey = keyof typeof FONT_PAIRS

/** Default pairing for each template id. */
export const TEMPLATE_DEFAULT_PAIR: Record<string, FontPairKey> = {
  minimal: 'fraunces-manrope',
  boutique: 'cormorant-jost',
  marche: 'bricolage-hanken',
  studio: 'syne-plex-sans',
}

const FALLBACK_KEY: FontPairKey = 'fraunces-manrope'

/**
 * Resolve the display/body families for a config. Honours an explicit
 * `fontPair` override when it names a known pair; otherwise falls back to the
 * template's default. Never throws.
 */
export function resolveFonts(config: { template?: string; fontPair?: string | null }): FontPair {
  const tpl = config.template ?? 'minimal'
  const overrideKey = config.fontPair
  const key: FontPairKey =
    overrideKey && overrideKey in FONT_PAIRS
      ? (overrideKey as FontPairKey)
      : TEMPLATE_DEFAULT_PAIR[tpl] ?? FALLBACK_KEY
  return FONT_PAIRS[key]
}

/** Sentinel value used by the customizer select to mean "use the template default". */
export const DEFAULT_FONT_SENTINEL = '__default__'
