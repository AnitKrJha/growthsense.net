/** Search, filter and a simple TDS amount helper over `tdsRows`. Pure functions, no UI. */
import { tdsRows, type TdsCategory, type TdsRow } from './tds-rates';

export type PayeeType = 'individual' | 'others';

const norm = (s: string) => s.toLowerCase().replace(/[\s()]/g, '');

/** Case-insensitive match on section, nature, threshold and keywords. "194i" matches 194I(a), 194I(b), 194IA, 194IB. */
export function searchTds(
  query: string,
  category: TdsCategory | 'all' = 'all',
  rows: readonly TdsRow[] = tdsRows,
): TdsRow[] {
  const q = query.trim().toLowerCase();
  const qSection = norm(q);
  return rows.filter((r) => {
    if (category !== 'all' && r.category !== category) return false;
    if (!q) return true;
    if (norm(r.section).startsWith(qSection)) return true;
    const hay = `${r.nature} ${r.threshold} ${r.keywords ?? ''} ${r.note ?? ''}`.toLowerCase();
    return q.split(/\s+/).every((word) => hay.includes(word));
  });
}

export function findTdsRow(section: string, rows: readonly TdsRow[] = tdsRows): TdsRow | undefined {
  return rows.find((r) => r.section === section);
}

export function rateFor(row: TdsRow, payee: PayeeType): number | null {
  return payee === 'individual' ? row.rateIndividual : row.rateOthers;
}

export interface TdsAmountResult {
  rate: number;
  /** Amount TDS is charged on (after `onExcessOver`, if any). */
  base: number;
  /** Rounded to the nearest rupee (s.288B). */
  tds: number;
  netPayable: number;
}

/**
 * amount × rate for a row, rounded to the rupee. Returns null if the row has no single rate (192, 195).
 * Does not check thresholds: the caller shows `row.threshold` as a reminder.
 */
export function computeTds(row: TdsRow, payee: PayeeType, amount: number): TdsAmountResult | null {
  const rate = rateFor(row, payee);
  if (rate === null) return null;
  const gross = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const base = Math.max(0, gross - (row.onExcessOver ?? 0));
  // rate × 1000 keeps 0.1% as an integer; one division limits float error.
  const tds = Math.round((base * Math.round(rate * 1000)) / 100000);
  return { rate, base, tds, netPayable: Math.round((gross - tds) * 100) / 100 };
}
