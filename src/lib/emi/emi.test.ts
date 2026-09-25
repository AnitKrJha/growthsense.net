import { describe, expect, it } from 'vitest';
import { amortise, calculateEmi } from './emi';

describe('calculateEmi', () => {
  it('₹1,00,000 at 12% for 12 months = ₹8,884.88', () => {
    // r = 1%; (1.01)^12 = 1.126825; 1,00,000 × 0.01 × 1.126825 / 0.126825 = 8,884.879
    expect(calculateEmi({ principal: 100000, annualRate: 12, months: 12 })).toBe(8884.88);
  });

  it('₹50 lakh at 8.5% for 20 years = ₹43,391.16', () => {
    expect(calculateEmi({ principal: 5000000, annualRate: 8.5, months: 240 })).toBe(43391.16);
  });

  it('₹10 lakh at 10% for 10 years = ₹13,215.07', () => {
    expect(calculateEmi({ principal: 1000000, annualRate: 10, months: 120 })).toBe(13215.07);
  });

  it('0% rate splits the principal evenly', () => {
    expect(calculateEmi({ principal: 120000, annualRate: 0, months: 12 })).toBe(10000);
    expect(calculateEmi({ principal: 1000, annualRate: 0, months: 3 })).toBe(333.33);
  });

  it('one month: principal plus one month of interest', () => {
    expect(calculateEmi({ principal: 10000, annualRate: 12, months: 1 })).toBe(10100);
  });

  it('zero or negative principal gives 0', () => {
    expect(calculateEmi({ principal: 0, annualRate: 10, months: 12 })).toBe(0);
    expect(calculateEmi({ principal: -5000, annualRate: 10, months: 12 })).toBe(0);
  });

  it('rejects bad rate or tenure', () => {
    expect(() => calculateEmi({ principal: 1000, annualRate: -1, months: 12 })).toThrow(RangeError);
    expect(() => calculateEmi({ principal: 1000, annualRate: 10, months: 0 })).toThrow(RangeError);
    expect(() => calculateEmi({ principal: 1000, annualRate: 10, months: 2.5 })).toThrow(RangeError);
  });
});

describe('amortise', () => {
  it('first rows of ₹1,00,000 at 12% for 12 months', () => {
    const { schedule } = amortise({ principal: 100000, annualRate: 12, months: 12 });
    expect(schedule).toHaveLength(12);
    // Month 1: interest 1% of 1,00,000 = 1,000; principal 7,884.88
    expect(schedule[0]).toEqual({ month: 1, opening: 100000, emi: 8884.88, interest: 1000, principal: 7884.88, closing: 92115.12 });
    // Month 2: interest 1% of 92,115.12 = 921.15; principal 7,963.73
    expect(schedule[1]).toMatchObject({ opening: 92115.12, interest: 921.15, principal: 7963.73, closing: 84151.39 });
  });

  it('ends at exactly zero and the totals add up', () => {
    const r = amortise({ principal: 100000, annualRate: 12, months: 12 });
    const last = r.schedule.at(-1)!;
    expect(last.closing).toBe(0);
    const principalSum = r.schedule.reduce((a, row) => a + Math.round(row.principal * 100), 0);
    expect(principalSum).toBe(10000000);
    expect(r.totalPayment).toBeCloseTo(100000 + r.totalInterest, 2);
    // 8,884.88 × 12 − 1,00,000 ≈ 6,618.56; the last instalment absorbs a few paise
    expect(r.totalInterest).toBeGreaterThan(6618.4);
    expect(r.totalInterest).toBeLessThan(6618.7);
    expect(Math.abs(last.emi - r.emi)).toBeLessThan(0.12);
  });

  it('0%: no interest, the last row takes the leftover paisa', () => {
    const r = amortise({ principal: 1000, annualRate: 0, months: 3 });
    expect(r.schedule.map((s) => s.emi)).toEqual([333.33, 333.33, 333.34]);
    expect(r.totalInterest).toBe(0);
    expect(r.totalPayment).toBe(1000);
  });

  it('zero principal gives an empty schedule', () => {
    expect(amortise({ principal: 0, annualRate: 9, months: 60 })).toEqual({
      emi: 0,
      totalInterest: 0,
      totalPayment: 0,
      schedule: [],
    });
  });
});
