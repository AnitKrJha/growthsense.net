const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ₹12,00,000 */
export const formatINR = (n: number, paise = false): string => (paise ? inr2 : inr0).format(n);
/** 12,00,000 */
export const formatNumberIN = (n: number): string => num.format(n);

/** Parses user input like "12,00,000" or "₹ 1.5L"-free plain numbers. Returns 0 for empty/invalid. */
export function parseAmount(s: string): number {
  const n = Number(s.replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
