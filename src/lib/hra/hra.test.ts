import { describe, expect, it } from 'vitest';
import { computeHra, hraMetroCities } from './hra';

describe('computeHra', () => {
  it('metro, monthly inputs: rent limit applies', () => {
    // salary 50,000 × 12 = 6,00,000; HRA 2,40,000; rent 2,64,000 − 60,000 = 2,04,000; 50% = 3,00,000
    const r = computeHra({ basic: 50000, da: 0, hraReceived: 20000, rentPaid: 22000, metro: true, period: 'monthly' });
    expect(r.salary).toBe(600000);
    expect(r.limits.map((l) => l.amount)).toEqual([240000, 204000, 300000]);
    expect(r.applied).toBe('rent');
    expect(r.exempt).toBe(204000);
    expect(r.taxable).toBe(36000);
    expect(r.salaryPercent).toBe(50);
    expect(r.landlordPanRequired).toBe(true);
  });

  it('non-metro, annual inputs with DA: 40% of salary applies', () => {
    // salary 4,80,000 + 20,000 = 5,00,000; HRA 2,40,000; rent 3,00,000 − 50,000 = 2,50,000; 40% = 2,00,000
    const r = computeHra({ basic: 480000, da: 20000, hraReceived: 240000, rentPaid: 300000, metro: false, period: 'annual' });
    expect(r.limits.map((l) => l.amount)).toEqual([240000, 250000, 200000]);
    expect(r.applied).toBe('salary');
    expect(r.exempt).toBe(200000);
    expect(r.taxable).toBe(40000);
  });

  it('actual HRA is the lowest', () => {
    // salary 12,00,000; HRA 1,20,000; rent 4,80,000 − 1,20,000 = 3,60,000; 50% = 6,00,000
    const r = computeHra({ basic: 1200000, da: 0, hraReceived: 120000, rentPaid: 480000, metro: true, period: 'annual' });
    expect(r.applied).toBe('actual');
    expect(r.exempt).toBe(120000);
    expect(r.taxable).toBe(0);
  });

  it('rent below 10% of salary gives no exemption', () => {
    // salary 6,00,000; rent 50,000 < 60,000 → limit is 0, not negative
    const r = computeHra({ basic: 600000, da: 0, hraReceived: 180000, rentPaid: 50000, metro: false, period: 'annual' });
    expect(r.limits[1].amount).toBe(0);
    expect(r.applied).toBe('rent');
    expect(r.exempt).toBe(0);
    expect(r.taxable).toBe(180000);
    expect(r.landlordPanRequired).toBe(false);
  });

  it('reports the first limit on a tie', () => {
    // salary 6,00,000; HRA 2,40,000; rent 3,00,000 − 60,000 = 2,40,000
    const r = computeHra({ basic: 50000, da: 0, hraReceived: 20000, rentPaid: 25000, metro: true, period: 'monthly' });
    expect(r.applied).toBe('actual');
    expect(r.exempt).toBe(240000);
  });

  it('keeps paise from percentages', () => {
    // salary 3,33,333; 10% = 33,333.30; rent 1,20,000 → 86,666.70; 40% = 1,33,333.20
    const r = computeHra({ basic: 333333, da: 0, hraReceived: 150000, rentPaid: 120000, metro: false, period: 'annual' });
    expect(r.limits[1].amount).toBe(86666.7);
    expect(r.limits[2].amount).toBe(133333.2);
    expect(r.exempt).toBe(86666.7);
    expect(r.taxable).toBe(63333.3);
  });

  it('landlord PAN is needed only when annual rent exceeds 1,00,000', () => {
    const base = { basic: 30000, da: 0, hraReceived: 10000, metro: false, period: 'annual' as const };
    expect(computeHra({ ...base, rentPaid: 100000 }).landlordPanRequired).toBe(false);
    expect(computeHra({ ...base, rentPaid: 100001 }).landlordPanRequired).toBe(true);
    // monthly 8,500 × 12 = 1,02,000
    expect(computeHra({ ...base, period: 'monthly', rentPaid: 8500 }).landlordPanRequired).toBe(true);
  });

  it('zero or negative inputs give zero', () => {
    const r = computeHra({ basic: -1000, da: Number.NaN, hraReceived: -5, rentPaid: 0, metro: true, period: 'monthly' });
    expect(r.salary).toBe(0);
    expect(r.exempt).toBe(0);
    expect(r.taxable).toBe(0);
    expect(r.limits.every((l) => l.amount === 0)).toBe(true);
  });

  it('no HRA received means nothing is exempt', () => {
    const r = computeHra({ basic: 50000, da: 0, hraReceived: 0, rentPaid: 30000, metro: true, period: 'monthly' });
    expect(r.exempt).toBe(0);
  });
});

describe('metro list', () => {
  it('has the four long-standing metros and a verify note', () => {
    expect(hraMetroCities.cities).toEqual(['Delhi', 'Mumbai', 'Kolkata', 'Chennai']);
    expect(hraMetroCities.status).toBe('unverified');
    expect(hraMetroCities.verifyNote).toMatch(/VERIFY/);
  });
});
