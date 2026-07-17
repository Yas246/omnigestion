'use client';

import { useMemo } from 'react';
import type { InvoiceItemInput } from '@/types';

export interface InvoiceTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
}

/**
 * Pure calculation of invoice totals from items + tax + discount + payment.
 * Extracted from InvoiceDialog (991 lines) for reuse + testability.
 */
export function useInvoiceTotals(
  items: InvoiceItemInput[],
  taxRate: number,
  discount: number,
  paidAmount: number,
): InvoiceTotals {
  return useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal - discount + taxAmount;
    const remainingAmount = total - paidAmount;
    return { subtotal, taxAmount, total, paidAmount, remainingAmount };
  }, [items, taxRate, discount, paidAmount]);
}
