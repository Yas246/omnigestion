/**
 * Storefront (site vitrine) config: defaults + merge.
 * The merchant edits a draft `config` (template, colors, sections…); the public
 * store serves `published_config` merged over these defaults so missing keys are
 * always filled.
 */
export const StorefrontService = {
  DEFAULT_CONFIG: {
    template: 'minimal',
    colors: { primary: '#4f46e5', accent: '#f59e0b', background: '#ffffff', text: '#1f2937' },
    font: 'inter',
    hero: { enabled: true, title: 'Bienvenue', subtitle: '', image: null, cta: 'Voir les produits' },
    sections: [
      { type: 'products', enabled: true, columns: 4 },
      { type: 'categories', enabled: true },
      { type: 'about', enabled: false },
      { type: 'contact', enabled: true },
    ],
    productDisplay: { showPrice: true, showStock: false, columns: 4 },
    footer: { text: '', social: {} },
  },

  /** Deep-merge the merchant config over the defaults (arrays replaced). */
  withDefaults(cfg: Record<string, any> | null | undefined): Record<string, any> {
    return deepMerge(this.DEFAULT_CONFIG, cfg ?? {})
  },
}

function deepMerge(base: any, override: any): any {
  if (Array.isArray(base)) return override ?? base
  if (base && typeof base === 'object') {
    const out: Record<string, any> = { ...base }
    if (override && typeof override === 'object') {
      for (const k of Object.keys(override)) out[k] = deepMerge(base[k], override[k])
    }
    return out
  }
  return override !== undefined ? override : base
}
