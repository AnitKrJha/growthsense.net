/**
 * Advance tax schedule and a rough 234B / 234C interest estimate (Income-tax Act, 1961 wording). VERIFY.
 *
 * This is an ESTIMATE. It works from one "tax payable after TDS/TCS" figure, assumes the same figure is
 * the tax on returned/assessed income, and ignores relief for capital gains, lottery or new-business income
 * arising after an instalment date. The Income-tax Act, 2025 (from 1 Apr 2026) renumbers these sections.
 *
 * Rules modelled (all VERIFY):
 * - No advance tax if the year's tax after TDS/TCS is below ₹10,000 (s.208).
 * - Resident senior citizens (60+) with no business/profession income are exempt (s.207).
 * - Regular: 15 Jun 15%, 15 Sep 45%, 15 Dec 75%, 15 Mar 100% (cumulative, s.211).
 * - Presumptive 44AD/44ADA: 100% by 15 Mar in one instalment.
 * - 234C: 1% per month on the shortfall against each cumulative target: 3 months for the first three
 *   instalments, 1 month for the last. No interest for 15 Jun if at least 12% was paid, or for 15 Sep if
 *   at least 36% was paid. Presumptive: only the 15 Mar shortfall, 1 month.
 * - 234B: if advance tax paid is under 90% of tax, 1% per month (part month = full month) on the
 *   shortfall, from 1 April after the year-end to the month the tax is paid / return filed.
 * - Rule 119A: the amount on which interest is charged is rounded down to a multiple of ₹100.
 */

export const ADVANCE_TAX_THRESHOLD = 10000;
export const ADVANCE_TAX_VERIFIED = { status: 'unverified' as const, checkedOn: '2026-09-26' };

export interface Instalment {
  id: 'jun' | 'sep' | 'dec' | 'mar';
  dueDate: string;
  /** Cumulative percent due by this date. */
  cumulativePercent: number;
  /** 234C "safe harbour": no interest if at least this cumulative percent was paid. */
  safeHarbourPercent: number;
  /** Months of 234C interest on a shortfall. */
  interestMonths: number;
}

export const regularInstalments: readonly Instalment[] = [
  { id: 'jun', dueDate: '15 Jun', cumulativePercent: 15, safeHarbourPercent: 12, interestMonths: 3 },
  { id: 'sep', dueDate: '15 Sep', cumulativePercent: 45, safeHarbourPercent: 36, interestMonths: 3 },
  { id: 'dec', dueDate: '15 Dec', cumulativePercent: 75, safeHarbourPercent: 75, interestMonths: 3 },
  { id: 'mar', dueDate: '15 Mar', cumulativePercent: 100, safeHarbourPercent: 100, interestMonths: 1 },
];

const presumptiveInstalments: readonly Instalment[] = regularInstalments.map((i) =>
  i.id === 'mar' ? i : { ...i, cumulativePercent: 0, safeHarbourPercent: 0, interestMonths: 0 },
);

/** Months after year-end for 234B, 1 = April … 12 = March. */
export const filingMonths = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March',
] as const;

export interface AdvanceTaxInput {
  /** Estimated tax for the year after TDS/TCS. */
  estimatedTax: number;
  /** Business/professional income taxed under 44AD / 44ADA only. */
  presumptive?: boolean;
  /** Resident aged 60+ with no business or professional income. */
  seniorNoBusiness?: boolean;
  /**
   * Amounts actually paid in each window: [by 15 Jun, 16 Jun–15 Sep, 16 Sep–15 Dec, 16 Dec–15 Mar].
   * Omit to get only the schedule.
   */
  paid?: readonly number[];
  /** 234B end month: 1 = April after the year-end … 12 = March. Default 4 (July). */
  filingMonth?: number;
}

export interface ScheduleRow {
  id: Instalment['id'];
  dueDate: string;
  cumulativePercent: number;
  /** Cumulative amount due by this date, rounded up to the rupee. */
  cumulativeDue: number;
  /** Amount of this instalment. */
  instalment: number;
  /** Present only when `paid` was given. */
  paidCumulative?: number;
  shortfall?: number;
  interest234C?: number;
}

export type NotLiableReason = 'nil' | 'below-threshold' | 'senior-exempt';

export interface AdvanceTaxResult {
  estimatedTax: number;
  liable: boolean;
  reason?: NotLiableReason;
  presumptive: boolean;
  schedule: ScheduleRow[];
  /** Present only when `paid` was given and the taxpayer is liable. */
  interest?: {
    totalPaid: number;
    total234C: number;
    b234: { applies: boolean; shortfall: number; months: number; interest: number };
    total: number;
  };
}

const clamp0 = (n: number | undefined) => (n !== undefined && Number.isFinite(n) && n > 0 ? n : 0);
/** Rule 119A: ignore any fraction of ₹100. */
export const floorTo100 = (n: number) => (n > 0 ? Math.floor(n / 100) * 100 : 0);
/** Percent of an amount in paise-exact integer maths, returned in rupees. */
const pct = (amount: number, percent: number) => Math.round(amount * 100 * percent) / 10000;

export function computeAdvanceTax(input: AdvanceTaxInput): AdvanceTaxResult {
  const tax = Math.round(clamp0(input.estimatedTax));
  const presumptive = !!input.presumptive;
  const plan = presumptive ? presumptiveInstalments : regularInstalments;

  let reason: NotLiableReason | undefined;
  if (tax === 0) reason = 'nil';
  else if (input.seniorNoBusiness && !presumptive) reason = 'senior-exempt';
  else if (tax < ADVANCE_TAX_THRESHOLD) reason = 'below-threshold';
  const liable = !reason;

  let prevDue = 0;
  const schedule: ScheduleRow[] = plan.map((i) => {
    const cumulativeDue = liable ? Math.ceil(pct(tax, i.cumulativePercent)) : 0;
    const row: ScheduleRow = {
      id: i.id,
      dueDate: i.dueDate,
      cumulativePercent: liable ? i.cumulativePercent : 0,
      cumulativeDue,
      instalment: cumulativeDue - prevDue,
    };
    prevDue = cumulativeDue;
    return row;
  });

  const result: AdvanceTaxResult = { estimatedTax: tax, liable, reason, presumptive, schedule };
  if (!input.paid || !liable) return result;

  let paidCum = 0;
  let total234C = 0;
  plan.forEach((i, idx) => {
    paidCum += clamp0(input.paid?.[idx]);
    const row = schedule[idx];
    row.paidCumulative = paidCum;
    const target = pct(tax, i.cumulativePercent);
    const safe = pct(tax, i.safeHarbourPercent);
    const shortfall = i.interestMonths > 0 && paidCum < safe ? Math.max(0, target - paidCum) : 0;
    row.shortfall = Math.round(shortfall * 100) / 100;
    row.interest234C = Math.round((floorTo100(shortfall) * i.interestMonths) / 100);
    total234C += row.interest234C;
  });

  const months = Math.min(12, Math.max(1, Math.round(input.filingMonth ?? 4)));
  const applies = paidCum < pct(tax, 90);
  const shortfallB = applies ? Math.max(0, tax - paidCum) : 0;
  const interestB = Math.round((floorTo100(shortfallB) * months) / 100);

  result.interest = {
    totalPaid: paidCum,
    total234C,
    b234: { applies, shortfall: shortfallB, months, interest: interestB },
    total: total234C + interestB,
  };
  return result;
}
