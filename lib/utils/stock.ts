/**
 * Stock status helper with floating-point safety.
 * Replaces `=== 0` comparisons with epsilon check.
 */

export function isZero(n: number): boolean {
  return Math.abs(n) < 0.001;
}

export function getStockStatus(stock: number, alertThreshold: number): 'ok' | 'low' | 'out' {
  if (isZero(stock)) return 'out';
  if (stock <= alertThreshold) return 'low';
  return 'ok';
}

/** Round to 3 decimal places to prevent floating-point drift */
export function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}
