/**
 * Pure GST maths. Works in integer paise so results are exact to the paisa.
 *
 * - exclusive: `amount` is the taxable value; GST is added on top.
 * - inclusive: `amount` already includes GST; the taxable value is backed out.
 * - intra-state: CGST + SGST/UTGST, each at half the rate, and always equal.
 * - inter-state: IGST at the full rate.
 *
 * Each tax component is rounded to the nearest paisa (half away from zero). Inclusive mode keeps the
 * gross figure exact, so the taxable value is gross minus the rounded tax.
 */

export type GstMode = 'exclusive' | 'inclusive';
export type SupplyType = 'intra' | 'inter';

export interface GstInput {
  amount: number;
  /** Percent, e.g. 18. */
  rate: number;
  mode: GstMode;
  supply: SupplyType;
}

export interface GstLine {
  label: string;
  /** Percent applied for this line, if it is a tax line. */
  rate?: number;
  amount: number;
}

export interface GstResult {
  rate: number;
  mode: GstMode;
  supply: SupplyType;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grossAmount: number;
  /** Rows for the breakdown table, in display order. */
  lines: GstLine[];
}

/** Rate precision: 1 unit = 0.001%, so 0.25% / 2 = 0.125% stays an integer (125). */
const RATE_SCALE = 1000;
const HUNDRED_PERCENT = 100 * RATE_SCALE;

export function toPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) return 0;
  // toFixed first so values like 10.005 (stored as 10.00499...) round the way a person expects.
  return Math.round(Number((rupees * 100).toFixed(6)));
}

const fromPaise = (p: number): number => p / 100;

export function computeGst(input: GstInput): GstResult {
  const { rate, mode, supply } = input;
  if (!Number.isFinite(rate) || rate < 0) throw new RangeError(`Invalid GST rate: ${rate}`);

  const units = Math.round(rate * RATE_SCALE);
  const halfUnits = units / 2; // may be x.5 only for rates with 4+ decimals, which we do not use
  const amountPaise = Math.max(0, toPaise(input.amount));

  let taxable: number;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (mode === 'exclusive') {
    taxable = amountPaise;
    if (supply === 'intra') {
      cgst = Math.round((taxable * halfUnits) / HUNDRED_PERCENT);
      sgst = cgst;
    } else {
      igst = Math.round((taxable * units) / HUNDRED_PERCENT);
    }
  } else {
    // tax = gross × r / (1 + r), computed with one division to limit float error.
    const denom = HUNDRED_PERCENT + units;
    if (supply === 'intra') {
      cgst = Math.round((amountPaise * halfUnits) / denom);
      sgst = cgst;
    } else {
      igst = Math.round((amountPaise * units) / denom);
    }
    taxable = amountPaise - cgst - sgst - igst;
  }

  const totalTax = cgst + sgst + igst;
  const gross = taxable + totalTax;
  const half = rate / 2;

  const lines: GstLine[] = [{ label: 'Taxable value', amount: fromPaise(taxable) }];
  if (supply === 'intra') {
    lines.push({ label: 'CGST', rate: half, amount: fromPaise(cgst) });
    lines.push({ label: 'SGST / UTGST', rate: half, amount: fromPaise(sgst) });
  } else {
    lines.push({ label: 'IGST', rate, amount: fromPaise(igst) });
  }
  lines.push({ label: 'Total GST', rate, amount: fromPaise(totalTax) });
  lines.push({ label: 'Total amount (incl. GST)', amount: fromPaise(gross) });

  return {
    rate,
    mode,
    supply,
    taxableValue: fromPaise(taxable),
    cgst: fromPaise(cgst),
    sgst: fromPaise(sgst),
    igst: fromPaise(igst),
    totalTax: fromPaise(totalTax),
    grossAmount: fromPaise(gross),
    lines,
  };
}

/** "9%" / "0.125%" without trailing zeros. */
export function formatRate(rate: number): string {
  return `${Number(rate.toFixed(3))}%`;
}
