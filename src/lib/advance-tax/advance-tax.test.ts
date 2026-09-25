import { describe, expect, it } from 'vitest';
import { computeAdvanceTax, floorTo100 } from './advance-tax';

const dues = (r: ReturnType<typeof computeAdvanceTax>) => r.schedule.map((s) => s.cumulativeDue);
const instalments = (r: ReturnType<typeof computeAdvanceTax>) => r.schedule.map((s) => s.instalment);

describe('schedule', () => {
  it('regular 15/45/75/100% on 1,00,000', () => {
    const r = computeAdvanceTax({ estimatedTax: 100000 });
    expect(r.liable).toBe(true);
    expect(dues(r)).toEqual([15000, 45000, 75000, 100000]);
    expect(instalments(r)).toEqual([15000, 30000, 30000, 25000]);
    expect(r.interest).toBeUndefined();
  });

  it('rounds cumulative dues up to the rupee', () => {
    // 1,23,457 × 15% = 18,518.55 → 18,519; × 45% = 55,555.65 → 55,556; × 75% = 92,592.75 → 92,593
    const r = computeAdvanceTax({ estimatedTax: 123457 });
    expect(dues(r)).toEqual([18519, 55556, 92593, 123457]);
    expect(instalments(r).reduce((a, b) => a + b, 0)).toBe(123457);
  });

  it('presumptive 44AD/44ADA: everything by 15 Mar', () => {
    const r = computeAdvanceTax({ estimatedTax: 50000, presumptive: true });
    expect(dues(r)).toEqual([0, 0, 0, 50000]);
    expect(instalments(r)).toEqual([0, 0, 0, 50000]);
  });

  it('below ₹10,000 is not liable; exactly ₹10,000 is', () => {
    const below = computeAdvanceTax({ estimatedTax: 9999, paid: [0, 0, 0, 0] });
    expect(below.liable).toBe(false);
    expect(below.reason).toBe('below-threshold');
    expect(dues(below)).toEqual([0, 0, 0, 0]);
    expect(below.interest).toBeUndefined();
    expect(computeAdvanceTax({ estimatedTax: 10000 }).liable).toBe(true);
  });

  it('zero and negative tax are nil', () => {
    expect(computeAdvanceTax({ estimatedTax: 0 }).reason).toBe('nil');
    expect(computeAdvanceTax({ estimatedTax: -5000 }).reason).toBe('nil');
  });

  it('senior citizen without business income is exempt, but not with presumptive income', () => {
    expect(computeAdvanceTax({ estimatedTax: 80000, seniorNoBusiness: true }).reason).toBe('senior-exempt');
    expect(computeAdvanceTax({ estimatedTax: 80000, seniorNoBusiness: true, presumptive: true }).liable).toBe(true);
  });
});

describe('234C', () => {
  it('nothing paid on 1,00,000: 450 + 1,350 + 2,250 + 1,000', () => {
    const r = computeAdvanceTax({ estimatedTax: 100000, paid: [0, 0, 0, 0] });
    expect(r.schedule.map((s) => s.interest234C)).toEqual([450, 1350, 2250, 1000]);
    expect(r.interest?.total234C).toBe(5050);
  });

  it('12% and 36% safe harbour for the first two instalments', () => {
    // cumulative paid 12,000 / 36,000 / 70,000 / 95,000
    const r = computeAdvanceTax({ estimatedTax: 100000, paid: [12000, 24000, 34000, 25000] });
    expect(r.schedule.map((s) => s.paidCumulative)).toEqual([12000, 36000, 70000, 95000]);
    expect(r.schedule.map((s) => s.shortfall)).toEqual([0, 0, 5000, 5000]);
    // Dec: 5,000 × 1% × 3 = 150; Mar: 5,000 × 1% × 1 = 50
    expect(r.schedule.map((s) => s.interest234C)).toEqual([0, 0, 150, 50]);
    expect(r.interest?.total234C).toBe(200);
  });

  it('just under the safe harbour charges on the full shortfall from 15%', () => {
    // 11,999 < 12,000 → shortfall 15,000 − 11,999 = 3,001 → 3,000 × 3% = 90
    const r = computeAdvanceTax({ estimatedTax: 100000, paid: [11999, 33001, 30000, 25000] });
    expect(r.schedule[0].shortfall).toBe(3001);
    expect(r.schedule[0].interest234C).toBe(90);
    expect(r.schedule[1].interest234C).toBe(0);
  });

  it('rounds the shortfall down to ₹100 (Rule 119A)', () => {
    // 1,23,457, nothing paid: 18,518.55→18,500 ×3% = 555; 55,555.65→55,500 = 1,665;
    // 92,592.75→92,500 = 2,775; 1,23,457→1,23,400 ×1% = 1,234
    const r = computeAdvanceTax({ estimatedTax: 123457, paid: [] });
    expect(r.schedule.map((s) => s.interest234C)).toEqual([555, 1665, 2775, 1234]);
    expect(r.interest?.total234C).toBe(6229);
  });

  it('presumptive: only the 15 Mar shortfall, 1 month', () => {
    const r = computeAdvanceTax({ estimatedTax: 50000, presumptive: true, paid: [0, 0, 0, 30000] });
    expect(r.schedule.map((s) => s.interest234C)).toEqual([0, 0, 0, 200]);
  });

  it('paying everything on time means no interest', () => {
    const r = computeAdvanceTax({ estimatedTax: 100000, paid: [15000, 30000, 30000, 25000], filingMonth: 7 });
    expect(r.interest?.total).toBe(0);
  });

  it('ignores negative payments', () => {
    const r = computeAdvanceTax({ estimatedTax: 100000, paid: [-15000, 0, 0, 0] });
    expect(r.interest?.totalPaid).toBe(0);
  });
});

describe('234B', () => {
  it('nothing paid, return filed in July: 1% × 4 months on 1,00,000', () => {
    const r = computeAdvanceTax({ estimatedTax: 100000, paid: [0, 0, 0, 0], filingMonth: 4 });
    expect(r.interest?.b234).toEqual({ applies: true, shortfall: 100000, months: 4, interest: 4000 });
    expect(r.interest?.total).toBe(9050);
  });

  it('does not apply when at least 90% was paid', () => {
    const r = computeAdvanceTax({ estimatedTax: 100000, paid: [15000, 30000, 30000, 15000] });
    expect(r.interest?.b234.applies).toBe(false);
    expect(r.interest?.b234.interest).toBe(0);
  });

  it('applies below 90% on the full shortfall, rounded down to ₹100', () => {
    // paid 89,950 < 90,000 → shortfall 10,050 → 10,000 × 1% × 1 month (April) = 100
    const r = computeAdvanceTax({ estimatedTax: 100000, paid: [15000, 30000, 30000, 14950], filingMonth: 1 });
    expect(r.interest?.b234).toEqual({ applies: true, shortfall: 10050, months: 1, interest: 100 });
  });

  it('defaults to July and clamps the month to 1–12', () => {
    const base = { estimatedTax: 100000, paid: [0, 0, 0, 0] };
    expect(computeAdvanceTax(base).interest?.b234.months).toBe(4);
    expect(computeAdvanceTax({ ...base, filingMonth: 0 }).interest?.b234.months).toBe(1);
    expect(computeAdvanceTax({ ...base, filingMonth: 20 }).interest?.b234.months).toBe(12);
  });
});

describe('floorTo100', () => {
  it('drops fractions of ₹100', () => {
    expect(floorTo100(18518.55)).toBe(18500);
    expect(floorTo100(99)).toBe(0);
    expect(floorTo100(-50)).toBe(0);
  });
});
