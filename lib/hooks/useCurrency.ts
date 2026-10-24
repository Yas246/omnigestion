'use client';

import { useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getCurrency } from '@/lib/constants/currencies';
import { formatMoney } from '@/lib/utils';

/**
 * Devise de l'entreprise courante + formatage des montants.
 * Fallback XOF/FCFA si aucune entreprise ou devise inconnue.
 */
export function useCurrency() {
  const { currentCompany } = useAuth();
  const currencyCode = currentCompany?.currency || 'XOF';
  const currencyLabel = getCurrency(currencyCode).label;
  const format = useCallback(
    (amount: number) => formatMoney(amount, currencyCode),
    [currencyCode]
  );
  return { currencyCode, currencyLabel, format };
}
