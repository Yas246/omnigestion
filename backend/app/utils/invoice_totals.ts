/**
 * Pure invoice totals calculation — source of truth for subtotal/tax/discount/
 * total/paid/remaining. Shared by create + update + cancel to guarantee
 * symmetric computation.
 */
export interface InvoiceTotals {
  subtotal: number
  taxAmount: number
  total: number
  paidAmount: number
  remainingAmount: number
  status: 'paid' | 'validated'
}

export function computeTotals(
  items: Array<{ unitPrice: number; quantity: number }>,
  taxRate: number,
  discount: number,
  requestedPaid: number,
): InvoiceTotals {
  const subtotal = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0)
  const taxable = Math.max(0, subtotal - discount)
  const taxAmount = Math.round((taxable * taxRate) / 100)
  const total = taxable + taxAmount
  const paidAmount = Math.max(0, Math.min(requestedPaid, total))
  const remainingAmount = Math.max(0, total - paidAmount)
  return { subtotal, taxAmount, total, paidAmount, remainingAmount, status: remainingAmount === 0 ? 'paid' : 'validated' }
}
