/**
 * HRA exemption, old tax regime (Income-tax Act, 1961: s.10(13A) + Rule 2A). VERIFY.
 *
 * Exempt HRA = least of:
 *   1. actual HRA received
 *   2. rent paid − 10% of salary
 *   3. 50% of salary (metro) or 40% (non-metro)
 * where "salary" = basic + DA that forms part of retirement benefits (+ turnover-based commission, which
 * callers can add to `da`). All figures are for the period rent was paid; this module works per year.
 *
 * Not available under the new regime (s.115BAC). Section numbers change under the Income-tax Act, 2025.
 */

/**
 * Metro cities for the 50% limit. VERIFY: Budget / new-Act rule proposals may extend the list to Bengaluru,
 * Hyderabad, Pune and Ahmedabad. Do not add them until the rule is confirmed as notified and in force.
 */
export const hraMetroCities = {
  status: 'unverified' as const,
  cities: ['Delhi', 'Mumbai', 'Kolkata', 'Chennai'] as const,
  verifyNote:
    'VERIFY: proposals under the new Income-tax Rules may add Bengaluru, Hyderabad, Pune and Ahmedabad as metros. Confirm before relying on the 40% / 50% choice.',
};

/** Annual rent above which the landlord's PAN must be given to the employer. VERIFY. */
export const LANDLORD_PAN_RENT_LIMIT = 100000;

export type HraPeriod = 'monthly' | 'annual';
export type HraLimitId = 'actual' | 'rent' | 'salary';

export interface HraInput {
  basic: number;
  /** DA forming part of retirement benefits. */
  da: number;
  hraReceived: number;
  rentPaid: number;
  metro: boolean;
  /** Whether the four amounts above are per month (×12) or per year. */
  period: HraPeriod;
}

export interface HraLimit {
  id: HraLimitId;
  label: string;
  /** Annual, never below 0. */
  amount: number;
}

export interface HraResult {
  /** Annualised inputs. */
  salary: number;
  hraReceived: number;
  rentPaid: number;
  limits: HraLimit[];
  /** Limit that sets the exemption. On a tie the earlier limit in `limits` is reported. */
  applied: HraLimitId;
  exempt: number;
  taxable: number;
  salaryPercent: 40 | 50;
  landlordPanRequired: boolean;
}

const clamp0 = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
const round2 = (n: number) => Math.round(Number((n * 100).toFixed(6))) / 100;

export function computeHra(input: HraInput): HraResult {
  const k = input.period === 'monthly' ? 12 : 1;
  const salary = round2((clamp0(input.basic) + clamp0(input.da)) * k);
  const hraReceived = round2(clamp0(input.hraReceived) * k);
  const rentPaid = round2(clamp0(input.rentPaid) * k);
  const salaryPercent = input.metro ? 50 : 40;

  const limits: HraLimit[] = [
    { id: 'actual', label: 'Actual HRA received', amount: hraReceived },
    { id: 'rent', label: 'Rent paid minus 10% of salary', amount: Math.max(0, round2(rentPaid - salary * 0.1)) },
    {
      id: 'salary',
      label: `${salaryPercent}% of salary (${input.metro ? 'metro' : 'non-metro'})`,
      amount: round2((salary * salaryPercent) / 100),
    },
  ];

  let applied = limits[0];
  for (const l of limits) if (l.amount < applied.amount) applied = l;

  const exempt = applied.amount;
  return {
    salary,
    hraReceived,
    rentPaid,
    limits,
    applied: applied.id,
    exempt,
    taxable: round2(hraReceived - exempt),
    salaryPercent,
    landlordPanRequired: rentPaid > LANDLORD_PAN_RENT_LIMIT,
  };
}
