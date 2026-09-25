/**
 * Rounding helpers for s.288A (total income) and s.288B (tax payable): ignore paise, then round to the
 * nearest multiple of ten, with a last digit of 5 or more going up.
 */

/** Tolerance so that 10,394.9999999 (float noise for 10,395) is treated as 10,395. */
const EPS = 1e-6;

export function roundToNearest(n: number, multiple = 10): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const rupees = Math.floor(n + EPS);
  return Math.floor((rupees + multiple / 2) / multiple) * multiple;
}

/** s.288A: total income rounded to the nearest ₹10. */
export const roundIncome = (n: number, multiple = 10): number => roundToNearest(n, multiple);

/** s.288B: tax rounded to the nearest ₹10. */
export const roundTax = (n: number, multiple = 10): number => roundToNearest(n, multiple);

/** Non-negative helper used throughout the engine. */
export const pos = (n: number | undefined): number => (n && Number.isFinite(n) && n > 0 ? n : 0);
