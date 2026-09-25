import { describe, expect, it } from 'vitest';
import { computeGst, formatRate, toPaise } from './gst';
import { findGstRate, gstRates, gstRatesMeta } from './rates';

describe('computeGst: exclusive', () => {
  it('adds 18% intra-state as 9% CGST + 9% SGST', () => {
    const r = computeGst({ amount: 1000, rate: 18, mode: 'exclusive', supply: 'intra' });
    expect(r).toMatchObject({ taxableValue: 1000, cgst: 90, sgst: 90, igst: 0, totalTax: 180, grossAmount: 1180 });
  });

  it('adds 40% inter-state as IGST', () => {
    const r = computeGst({ amount: 250000, rate: 40, mode: 'exclusive', supply: 'inter' });
    expect(r).toMatchObject({ taxableValue: 250000, cgst: 0, sgst: 0, igst: 100000, grossAmount: 350000 });
  });

  it('rounds each component to the paisa (10.10 @ 5%)', () => {
    // 1010 paise × 2.5% = 25.25 paise → 25 each side; × 5% = 50.5 paise → 51 (half away from zero)
    const intra = computeGst({ amount: 10.1, rate: 5, mode: 'exclusive', supply: 'intra' });
    expect(intra).toMatchObject({ cgst: 0.25, sgst: 0.25, totalTax: 0.5, grossAmount: 10.6 });
    const inter = computeGst({ amount: 10.1, rate: 5, mode: 'exclusive', supply: 'inter' });
    expect(inter).toMatchObject({ igst: 0.51, totalTax: 0.51, grossAmount: 10.61 });
  });

  it('handles the 0.25% special rate (half = 0.125%)', () => {
    // 99999 paise × 0.125% = 124.99875 → 125 paise
    const r = computeGst({ amount: 999.99, rate: 0.25, mode: 'exclusive', supply: 'intra' });
    expect(r).toMatchObject({ cgst: 1.25, sgst: 1.25, totalTax: 2.5, grossAmount: 1002.49 });
  });

  it('0% rate adds nothing', () => {
    const r = computeGst({ amount: 500, rate: 0, mode: 'exclusive', supply: 'intra' });
    expect(r).toMatchObject({ taxableValue: 500, totalTax: 0, grossAmount: 500 });
  });
});

describe('computeGst: inclusive', () => {
  it('backs out 18% IGST from 1,180', () => {
    const r = computeGst({ amount: 1180, rate: 18, mode: 'inclusive', supply: 'inter' });
    expect(r).toMatchObject({ taxableValue: 1000, igst: 180, grossAmount: 1180 });
  });

  it('backs out 3% CGST+SGST from 10,300', () => {
    const r = computeGst({ amount: 10300, rate: 3, mode: 'inclusive', supply: 'intra' });
    expect(r).toMatchObject({ taxableValue: 10000, cgst: 150, sgst: 150, grossAmount: 10300 });
  });

  it('keeps the gross exact when the split is not round (100 @ 18%)', () => {
    // CGST = 10000 × 9 / 118 = 762.71 paise → 7.63; taxable = 100 − 15.26 = 84.74
    const intra = computeGst({ amount: 100, rate: 18, mode: 'inclusive', supply: 'intra' });
    expect(intra).toMatchObject({ cgst: 7.63, sgst: 7.63, totalTax: 15.26, taxableValue: 84.74, grossAmount: 100 });
    // IGST = 10000 × 18 / 118 = 1525.42 paise → 15.25; taxable = 84.75
    const inter = computeGst({ amount: 100, rate: 18, mode: 'inclusive', supply: 'inter' });
    expect(inter).toMatchObject({ igst: 15.25, taxableValue: 84.75, grossAmount: 100 });
  });

  it('0% inclusive: taxable equals gross', () => {
    const r = computeGst({ amount: 499.5, rate: 0, mode: 'inclusive', supply: 'inter' });
    expect(r).toMatchObject({ taxableValue: 499.5, igst: 0, grossAmount: 499.5 });
  });
});

describe('computeGst: edge cases', () => {
  it('treats zero, negative and NaN amounts as 0', () => {
    for (const amount of [0, -100, Number.NaN]) {
      const r = computeGst({ amount, rate: 18, mode: 'exclusive', supply: 'intra' });
      expect(r).toMatchObject({ taxableValue: 0, totalTax: 0, grossAmount: 0 });
    }
  });

  it('rejects a negative or non-finite rate', () => {
    expect(() => computeGst({ amount: 100, rate: -5, mode: 'exclusive', supply: 'intra' })).toThrow(RangeError);
    expect(() => computeGst({ amount: 100, rate: Number.NaN, mode: 'exclusive', supply: 'intra' })).toThrow(RangeError);
  });

  it('rounds input to paise the way people expect', () => {
    expect(toPaise(10.005)).toBe(1001);
    expect(toPaise(0.1 + 0.2)).toBe(30);
  });

  it('builds breakdown lines in order', () => {
    const intra = computeGst({ amount: 1000, rate: 18, mode: 'exclusive', supply: 'intra' });
    expect(intra.lines.map((l) => l.label)).toEqual([
      'Taxable value',
      'CGST',
      'SGST / UTGST',
      'Total GST',
      'Total amount (incl. GST)',
    ]);
    expect(intra.lines[1].rate).toBe(9);
    const inter = computeGst({ amount: 1000, rate: 18, mode: 'exclusive', supply: 'inter' });
    expect(inter.lines.map((l) => l.label)).toContain('IGST');
  });

  it('formats rates without trailing zeros', () => {
    expect(formatRate(9)).toBe('9%');
    expect(formatRate(0.125)).toBe('0.125%');
    expect(formatRate(2.5)).toBe('2.5%');
  });
});

describe('gst rates data', () => {
  it('is marked unverified and has the GST 2.0 slabs', () => {
    expect(gstRatesMeta.status).toBe('unverified');
    const main = gstRates.filter((r) => r.group === 'main').map((r) => r.rate);
    expect(main).toEqual([5, 18, 40]);
    expect(findGstRate('0.25')?.rate).toBe(0.25);
    expect(findGstRate('12-legacy')?.group).toBe('legacy');
  });

  it('has unique ids', () => {
    expect(new Set(gstRates.map((r) => r.id)).size).toBe(gstRates.length);
  });
});
