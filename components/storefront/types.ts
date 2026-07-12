/** Shared types for the storefront (site vitrine). */

export interface StorefrontColors {
  primary: string
  accent: string
  background: string
  text: string
}

export interface StorefrontHero {
  enabled: boolean
  title: string
  subtitle: string
  image: string | null
  cta: string
}

export interface StorefrontSection {
  type: 'products' | 'categories' | 'about' | 'contact'
  enabled: boolean
  columns?: number
}

export interface StorefrontConfig {
  template: string
  colors: StorefrontColors
  font: string
  hero: StorefrontHero
  sections: StorefrontSection[]
  productDisplay: { showPrice: boolean; showStock: boolean; columns: number }
  footer: { text: string; social: Record<string, string> }
}

export interface StorefrontCompany {
  id: number
  name: string
  slogan: string | null
  description: string | null
  logoUrl: string | null
  bannerUrl: string | null
  phone: string | null
  email: string | null
  address: string | null
  currency: string
  storeSlug: string | null
}

export interface StorefrontProduct {
  id: number
  name: string
  code: string | null
  category: string | null
  description: string | null
  retailPrice: number
  currentStock?: number
  mainImageUrl: string | null
  unit: string | null
  images: Array<{ id: number; url: string; alt: string | null; position: number }>
}
