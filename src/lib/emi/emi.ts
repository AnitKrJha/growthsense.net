/**
 * Reducing-balance EMI and amortisation schedule. Library only (no page yet: the financing service is not
 * confirmed). Money is handled in integer paise.
 *
 * EMI = P × r × (1 + r)^n / ((1 + r)^n − 1), with r = annual rate / 12 / 100. At 0% the EMI is P / n.
 */

export interface EmiInput {
  principal: number;
  /** Annual interest rate in percent, e.g. 9.5. */
  annualRate: number;
  /** Tenure in months (whole number ≥ 1). */
  months: number;
}

export interface AmortisationRow {
  month: number;
  opening: number;
  emi: number;
  interest: number;
  principal: number;
  closing: number;
}

export interface EmiResult {
  /** EMI rounded to the paisa. The last instalment may differ slightly (see schedule). */
  emi: number;
  totalInterest: number;
  totalPayment: number;
  schedule: AmortisationRow[];
}

function validate({ annualRate, months }: EmiInput) {
  if (!Number.isFinite(annualRate) || annualRate < 0) throw new RangeError(`Invalid interest rate: ${annualRate}`);
  if (!Number.isInteger(months) || months < 1) throw new RangeError(`Invalid tenure: ${months}`);
}

const toPaise = (n: number) => Math.round(Number((n * 100).toFixed(6)));

/** EMI in rupees, rounded to the paisa. Returns 0 for a non-positive principal. */
export function calculateEmi(input: EmiInput): number {
  validate(input);
  const p = toPaise(input.principal);
  if (!(p > 0)) return 0;
  const r = input.annualRate / 12 / 100;
  if (r === 0) return Math.round(p / input.months) / 100;
  const f = (1 + r) ** input.months;
  return Math.round((p * r * f) / (f - 1)) / 100;
}

/**
 * Month-by-month schedule. Interest each month = round(opening × r) in paise. The final row absorbs any
 * rounding so the closing balance is exactly 0.
 */
export function amortise(input: EmiInput): EmiResult {
  const emi = calculateEmi(input);
  const p = toPaise(input.principal);
  if (!(p > 0)) return { emi: 0, totalInterest: 0, totalPayment: 0, schedule: [] };

  const r = input.annualRate / 12 / 100;
  const emiP = Math.round(emi * 100);
  const schedule: AmortisationRow[] = [];
  let balance = p;
  let totalInterest = 0;
  let totalPayment = 0;

  for (let m = 1; m <= input.months; m++) {
    const interest = Math.round(balance * r);
    const last = m === input.months;
    let principal = last ? balance : Math.min(balance, emiP - interest);
    if (principal < 0) principal = 0;
    const pay = principal + interest;
    schedule.push({
      month: m,
      opening: balance / 100,
      emi: pay / 100,
      interest: interest / 100,
      principal: principal / 100,
      closing: (balance - principal) / 100,
    });
    balance -= principal;
    totalInterest += interest;
    totalPayment += pay;
    if (balance === 0) break;
  }

  return { emi, totalInterest: totalInterest / 100, totalPayment: totalPayment / 100, schedule };
}
