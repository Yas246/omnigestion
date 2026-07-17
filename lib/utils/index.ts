/**
 * Barrel export — resolves `@/lib/utils` to this directory.
 * Re-exports `cn` + `formatPrice` from ./format (previously in lib/utils.ts).
 * Other modules (status, invoice-helpers, export, etc.) are imported via their
 * explicit paths: `@/lib/utils/status`, `@/lib/utils/invoice-helpers`, etc.
 */
export { cn, formatPrice } from './format'
