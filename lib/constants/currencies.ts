// Devises supportées par l'application.
// On stocke le code ISO dans company.currency, on affiche le label.

export interface CurrencyDef {
  code: string; // code ISO stocké en base (company.currency)
  label: string; // libellé affiché (suffixe)
  decimals: number; // décimales d'affichage
  name: string; // nom complet pour les Select
}

export const CURRENCIES: CurrencyDef[] = [
  { code: 'XOF', label: 'FCFA', decimals: 0, name: 'Franc CFA (FCFA)' },
  { code: 'MAD', label: 'Dhs', decimals: 2, name: 'Dirham marocain (Dhs)' },
  { code: 'EUR', label: '€', decimals: 2, name: 'Euro (€)' },
  { code: 'USD', label: '$', decimals: 2, name: 'Dollar US ($)' },
];

const FALLBACK = { code: 'XOF', label: 'FCFA', decimals: 0, name: 'Franc CFA (FCFA)' };

/**
 * Résout une devise depuis son code.
 * - 'FCFA' (ancienne valeur libre) est lu comme XOF
 * - code inconnu/absent → fallback XOF ; les valeurs exotiques déjà en base
 *   sont affichées telles quelles via label = code
 */
export function getCurrency(code: string | undefined | null): CurrencyDef {
  if (!code) return FALLBACK;
  const normalized = code.trim().toUpperCase();
  if (normalized === 'FCFA') return FALLBACK;
  const found = CURRENCIES.find((c) => c.code === normalized);
  if (found) return found;
  // Valeur libre héritée de l'ancien Input : l'afficher telle quelle
  return { code: normalized, label: code, decimals: 0, name: code };
}
