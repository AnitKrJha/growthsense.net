/**
 * Hand-computed cases for the income-tax engine, FY 2025-26 rules unless stated.
 *
 * NOTE: these expected values were worked out by hand from the rules file, NOT taken from the official
 * calculator (internet access was blocked). Every case still needs cross-checking against the Income Tax
 * Department calculator on incometax.gov.in before launch. If a case disagrees, fix the rules/engine
 * and the hand computation together.
 *
 * Shorthand: "other" = otherIncome (slab-rate income with no standard deduction), L = lakh, Cr = crore.
 * New-regime slab tax up to 24L = 0 + 20,000 + 40,000 + 60,000 + 80,000 + 1,00,000 = 3,00,000.
 * Old-regime (<60) slab tax up to 10L = 0 + 12,500 + 1,00,000 = 1,12,500.
 */
import { describe, expect, it } from 'vitest';
import { compareRegimes, computeTax, roundIncome, roundTax, roundToNearest, slabFill } from './index';
import { defaultYearId, fy2025_26, getRules, taxYears, ty2026_27 } from './rules';
import type { TaxInput } from './types';

const NEW = (i: Omit<TaxInput, 'regime' | 'age'> & { age?: TaxInput['age'] }) =>
  computeTax({ age: 'below60', ...i, regime: 'new' }, fy2025_26);
const OLD = (i: Omit<TaxInput, 'regime' | 'age'> & { age?: TaxInput['age'] }) =>
  computeTax({ age: 'below60', ...i, regime: 'old' }, fy2025_26);

describe('new regime: 87A rebate and marginal relief', () => {
  it('zero tax at exactly ₹12,00,000 taxable', () => {
    // Slab tax: 4-8L 5% = 20,000; 8-12L 10% = 40,000 → 60,000. TI ≤ 12L → rebate 60,000 → 0.
    const b = NEW({ otherIncome: 1200000 });
    expect(b.totalIncome).toBe(1200000);
    expect(b.taxBeforeRebate).toBe(60000);
    expect(b.rebate).toBe(60000);
    expect(b.totalTax).toBe(0);
  });

  it('zero tax on ₹12,75,000 salary after the ₹75,000 standard deduction', () => {
    // 12,75,000 − 75,000 = 12,00,000 → as above, tax 0.
    const b = NEW({ salary: 1275000 });
    expect(b.income.standardDeduction).toBe(75000);
    expect(b.totalIncome).toBe(1200000);
    expect(b.totalTax).toBe(0);
  });

  it('marginal relief just above ₹12L: ₹12,10,000 → tax ₹10,000 + cess', () => {
    // Slab tax = 60,000 + 15% × 10,000 = 61,500. TI > 12L so no rebate.
    // Marginal relief = 61,500 − (12,10,000 − 12,00,000) = 51,500 → tax 10,000. Cess 4% = 400 → 10,400.
    const b = NEW({ otherIncome: 1210000 });
    expect(b.taxBeforeRebate).toBe(61500);
    expect(b.rebate).toBe(0);
    expect(b.rebateMarginalRelief).toBe(51500);
    expect(b.taxAfterRebate).toBe(10000);
    expect(b.cess).toBe(400);
    expect(b.totalTax).toBe(10400);
  });

  it('marginal relief applies at ₹12,70,580 and stops at ₹12,70,590', () => {
    // Relief ends where 60,000 + 0.15x = x, i.e. x = 70,588.24 above 12L.
    // At 12,70,580: slab tax = 60,000 + 0.15 × 70,580 = 70,587; cap 70,580 → relief 7.
    // Cess = 70,580 × 4% = 2,823.20 → 73,403.20 → 288B → 73,400.
    const b = NEW({ otherIncome: 1270580 });
    expect(b.rebateMarginalRelief).toBeCloseTo(7, 6);
    expect(b.totalTax).toBe(73400);
    // At 12,70,590: slab tax = 60,000 + 0.15 × 70,590 = 70,588.50 < 70,590 → no relief.
    // Cess 2,823.54 → 73,412.04 → 73,410.
    const after = NEW({ otherIncome: 1270590 });
    expect(after.rebateMarginalRelief).toBe(0);
    expect(after.totalTax).toBe(73410);
  });
});

describe('surcharge thresholds with marginal relief', () => {
  it('₹50L exactly: no surcharge; ₹50,10,000: 10% surcharge cut back by marginal relief', () => {
    // At 50L: slab tax = 3,00,000 + 30% × 26L = 10,80,000. Surcharge applies only above 50L.
    // Cess 43,200 → 11,23,200.
    const at = NEW({ otherIncome: 5000000 });
    expect(at.surcharge.rate).toBe(0);
    expect(at.totalTax).toBe(1123200);
    // Tax = 3,00,000 + 30% × 26,10,000 = 10,83,000. Surcharge 10% = 1,08,300 → 11,91,300.
    // Cap = tax at 50L (10,80,000) + excess 10,000 = 10,90,000 → relief 1,01,300, net surcharge 7,000.
    // Cess 4% of 10,90,000 = 43,600 → 11,33,600.
    const b = NEW({ otherIncome: 5010000 });
    expect(b.surcharge.gross).toBeCloseTo(108300, 6);
    expect(b.surcharge.marginalRelief).toBeCloseTo(101300, 6);
    expect(b.surcharge.net).toBeCloseTo(7000, 6);
    expect(b.totalTax).toBe(1133600);
  });

  it('₹51,70,000: surcharge marginal relief no longer applies', () => {
    // Relief ends where 1.1 × (10,80,000 + 0.3e) = 10,80,000 + e → e ≈ 1,61,194.
    // Tax = 10,80,000 + 30% × 1,70,000 = 11,31,000; +10% = 12,44,100 < cap 12,50,000 → no relief.
    // Cess 49,764 → 12,93,864 → 12,93,860.
    const b = NEW({ otherIncome: 5170000 });
    expect(b.surcharge.marginalRelief).toBe(0);
    expect(b.totalTax).toBe(1293860);
  });

  it('₹1,00,10,000: 15% surcharge with marginal relief at ₹1Cr', () => {
    // Tax = 3,00,000 + 30% × 76,10,000 = 25,83,000; 15% = 3,87,450 → 29,70,450.
    // At 1Cr: 25,80,000 + 10% 2,58,000 = 28,38,000; cap = 28,48,000 → relief 1,22,450.
    // Cess 4% of 28,48,000 = 1,13,920 → 29,61,920.
    const b = NEW({ otherIncome: 10010000 });
    expect(b.surcharge.rate).toBe(0.15);
    expect(b.surcharge.marginalRelief).toBeCloseTo(122450, 6);
    expect(b.totalTax).toBe(2961920);
  });

  it('₹2,00,10,000: 25% surcharge with marginal relief at ₹2Cr', () => {
    // Tax = 3,00,000 + 30% × 1,76,10,000 = 55,83,000; 25% = 13,95,750 → 69,78,750.
    // At 2Cr: 55,80,000 + 15% 8,37,000 = 64,17,000; cap 64,27,000 → relief 5,51,750.
    // Cess 2,57,080 → 66,84,080.
    const b = NEW({ otherIncome: 20010000 });
    expect(b.surcharge.rate).toBe(0.25);
    expect(b.surcharge.marginalRelief).toBeCloseTo(551750, 6);
    expect(b.totalTax).toBe(6684080);
  });

  it('₹5,00,10,000 old regime: 37% surcharge with marginal relief at ₹5Cr', () => {
    // Old tax = 1,12,500 + 30% × 4,90,10,000 = 1,48,15,500; 37% = 54,81,735 → 2,02,97,235.
    // At 5Cr: 1,48,12,500 + 25% 37,03,125 = 1,85,15,625; cap 1,85,25,625 → relief 17,71,610.
    // Cess 4% of 1,85,25,625 = 7,41,025 → 1,92,66,650.
    const b = OLD({ otherIncome: 50010000 });
    expect(b.surcharge.rate).toBe(0.37);
    expect(b.surcharge.marginalRelief).toBeCloseTo(1771610, 4);
    expect(b.totalTax).toBe(19266650);
  });

  it('new regime surcharge capped at 25% (₹5,00,10,000 and ₹6Cr vs old 37%)', () => {
    // Tax = 3,00,000 + 30% × 4,76,10,000 = 1,45,83,000; 25% = 36,45,750 → 1,82,28,750.
    // No 37% tier in the new regime, so no threshold at 5Cr. Cess 7,29,150 → 1,89,57,900.
    const b = NEW({ otherIncome: 50010000 });
    expect(b.surcharge.rate).toBe(0.25);
    expect(b.surcharge.marginalRelief).toBe(0);
    expect(b.totalTax).toBe(18957900);
    // New: 3,00,000 + 30% × 5,76,00,000 = 1,75,80,000 × 1.25 × 1.04 = 2,28,54,000.
    // Old: 1,12,500 + 30% × 5,90,00,000 = 1,78,12,500 × 1.37 × 1.04 = 2,53,79,250.
    const cmp = compareRegimes({ age: 'below60', otherIncome: 60000000 }, fy2025_26);
    expect(cmp.new.totalTax).toBe(22854000);
    expect(cmp.old.totalTax).toBe(25379250);
    expect(cmp.better).toBe('new');
  });
});

describe('old regime: ages and 87A', () => {
  it('87A rebate makes tax nil at ₹5,00,000 (below 60)', () => {
    // 2.5-5L 5% = 12,500; TI ≤ 5L → rebate 12,500 → 0.
    const b = OLD({ otherIncome: 500000 });
    expect(b.rebate).toBe(12500);
    expect(b.totalTax).toBe(0);
  });

  it('no rebate and no marginal relief just above ₹5L', () => {
    // TI 5,00,010: tax = 12,500 + 20% × 10 = 12,502; old regime has no 87A marginal relief.
    // Cess 500.08 → 13,002.08 → 13,000.
    const b = OLD({ otherIncome: 500010 });
    expect(b.rebate).toBe(0);
    expect(b.rebateMarginalRelief).toBe(0);
    expect(b.totalTax).toBe(13000);
  });

  it('senior and super-senior slabs', () => {
    // <60:   12,500 + 1,00,000 = 1,12,500 → 1,17,000.
    // 60-79: 3-5L 5% = 10,000 + 1,00,000 = 1,10,000 → 1,14,400.
    // 80+:   5-10L 20% = 1,00,000 → 1,04,000.
    expect(OLD({ otherIncome: 1000000 }).totalTax).toBe(117000);
    expect(OLD({ otherIncome: 1000000, age: '60to79' }).totalTax).toBe(114400);
    expect(OLD({ otherIncome: 1000000, age: '80plus' }).totalTax).toBe(104000);
    // 60-79 at 5L: 3-5L 5% = 10,000; rebate 10,000 → 0.
    // 80+ at 6L: 5-6L 20% = 20,000; TI > 5L so no rebate → 20,800.
    const s = OLD({ otherIncome: 500000, age: '60to79' });
    expect(s.rebate).toBe(10000);
    expect(s.totalTax).toBe(0);
    expect(OLD({ otherIncome: 600000, age: '80plus' }).totalTax).toBe(20800);
  });

});

describe('deductions and caps', () => {
  it('80C, 80CCD(1B) and 80D limits', () => {
    // 80C 2,00,000 → 1,50,000; 80CCD(1B) 80,000 → 50,000; 80D self 40,000 → 25,000 (<60);
    // 80D parents 60,000 → 50,000 (senior parents). Total 2,75,000 → TI 7,25,000.
    // Tax 12,500 + 20% × 2,25,000 = 57,500 → 59,800.
    const b = OLD({ otherIncome: 1000000, c80: 200000, ccd1b: 80000, d80Self: 40000, d80Parents: 60000, parentsSenior: true });
    const allowed = Object.fromEntries(b.deductions.map((d) => [d.key, d.allowed]));
    expect(allowed).toEqual({ c80: 150000, ccd1b: 50000, d80Self: 25000, d80Parents: 50000 });
    expect(b.totalDeductions).toBe(275000);
    expect(b.totalTax).toBe(59800);
    // 80D self limit rises to 50,000 when the taxpayer is a senior citizen.
    const s = OLD({ otherIncome: 1000000, d80Self: 60000, age: '60to79' });
    expect(s.deductions.find((d) => d.key === 'd80Self')?.allowed).toBe(50000);
  });

  it('24(b) self-occupied interest capped at ₹2L; ignored in the new regime', () => {
    // Old: 12L − 50,000 = 11,50,000; HP −2,00,000 (3L claimed) → 9,50,000.
    //      Tax 12,500 + 20% × 4,50,000 = 1,02,500 → 1,06,600.
    // New: 12L − 75,000 = 11,25,000 ≤ 12L → 0.
    const o = OLD({ salary: 1200000, homeLoanInterest: 300000 });
    expect(o.income.selfOccupiedInterest).toBe(200000);
    expect(o.totalTax).toBe(106600);
    const n = NEW({ salary: 1200000, homeLoanInterest: 300000 });
    expect(n.income.selfOccupiedInterest).toBe(0);
    expect(n.totalTax).toBe(0);
  });

  it('80TTA (₹10,000) below 60 and 80TTB (₹50,000) for seniors', () => {
    // <60: 6,00,000 + 15,000 savings interest; 80TTA 10,000 → 6,05,000.
    //      Tax 12,500 + 20% × 1,05,000 = 33,500 → 34,840.
    // 60-79: 6,00,000 + 20,000 + 60,000 FD = 6,80,000; 80TTB 50,000 → 6,30,000.
    //      Tax 10,000 + 20% × 1,30,000 = 36,000 → 37,440.
    const y = OLD({ otherIncome: 600000, savingsInterest: 15000 });
    expect(y.deductions.find((d) => d.key === 'tta')?.allowed).toBe(10000);
    expect(y.totalTax).toBe(34840);
    const s = OLD({ otherIncome: 600000, savingsInterest: 20000, depositInterest: 60000, age: '60to79' });
    expect(s.deductions.find((d) => d.key === 'ttb')?.allowed).toBe(50000);
    expect(s.totalTax).toBe(37440);
  });

  it('employer NPS 80CCD(2): 14% of basic + DA (new), 10% (old)', () => {
    // New: salary 20L, basic 10L, employer NPS 2L → allowed 1,40,000. TI = 20L − 75,000 − 1,40,000 = 17,85,000.
    //      Tax 1,20,000 + 20% × 1,85,000 = 1,57,000 → 1,63,280.
    // Old: allowed 1,00,000. TI = 20L − 50,000 − 1,00,000 = 18,50,000.
    //      Tax 1,12,500 + 30% × 8,50,000 = 3,67,500 → 3,82,200.
    const i = { salary: 2000000, basicPlusDA: 1000000, employerNps: 200000 };
    const n = NEW(i);
    expect(n.deductions.find((d) => d.key === 'ccd2')?.allowed).toBe(140000);
    expect(n.totalTax).toBe(163280);
    const o = OLD(i);
    expect(o.deductions.find((d) => d.key === 'ccd2')?.allowed).toBe(100000);
    expect(o.totalTax).toBe(382200);
  });

  it('HRA exemption (input) and ₹50,000 standard deduction in the old regime only', () => {
    // Old: 8L salary − 50,000 = 7,50,000; tax 12,500 + 20% × 2,50,000 = 62,500 → 65,000.
    const plain = OLD({ salary: 800000 });
    expect(plain.income.standardDeduction).toBe(50000);
    expect(plain.totalTax).toBe(65000);
    // Old: 10L − HRA 2L − 50,000 = 7,50,000 → 65,000.
    // New: 10L − 75,000 = 9,25,000 → rebate → 0.
    expect(OLD({ salary: 1000000, hraExemption: 200000 }).totalTax).toBe(65000);
    const n = NEW({ salary: 1000000, hraExemption: 200000 });
    expect(n.income.hraExemption).toBe(0);
    expect(n.totalTax).toBe(0);
  });

  it('family pension: 1/3 up to ₹15,000 (old) or ₹25,000 (new)', () => {
    // Pension 60,000: old deduction min(20,000, 15,000) = 15,000; with 5L other → TI 5,45,000.
    //   Tax 12,500 + 20% × 45,000 = 21,500 → 22,360.
    // New: min(20,000, 25,000) = 20,000.
    const o = OLD({ otherIncome: 500000, familyPension: 60000 });
    expect(o.income.familyPensionDeduction).toBe(15000);
    expect(o.totalTax).toBe(22360);
    expect(NEW({ otherIncome: 500000, familyPension: 60000 }).income.familyPensionDeduction).toBe(20000);
  });
});

describe('capital gains (111A / 112A)', () => {
  it('new regime: unused basic exemption set off against STCG; no rebate on STCG tax', () => {
    // Other 2L, STCG 5L → TI 7L. Unused exemption 4L − 2L = 2L → STCG taxable 3L × 20% = 60,000.
    // Normal tax 0, and the rebate cannot reduce 111A tax → 60,000 → 62,400.
    const b = NEW({ otherIncome: 200000, stcg111A: 500000 });
    expect(b.specialLines[0].basicExemptionSetOff).toBe(200000);
    expect(b.rebate).toBe(0);
    expect(b.totalTax).toBe(62400);
  });

  it('new regime: LTCG over ₹1.25L exemption at 12.5%, rebate only on normal tax', () => {
    // Other 10L, LTCG 2L → TI 12L ≤ 12L. Normal tax 40,000 fully rebated.
    // LTCG taxable 2L − 1.25L = 75,000 × 12.5% = 9,375 → 9,750.
    const b = NEW({ otherIncome: 1000000, ltcg112A: 200000 });
    expect(b.rebate).toBe(40000);
    expect(b.specialLines[0].exemption).toBe(125000);
    expect(b.totalTax).toBe(9750);
    // LTCG 6L, no other income. Set-off 4L → 2L; exemption 1.25L → 75,000 × 12.5% = 9,375 → 9,750.
    // TI 6L ≤ 12L, but the rebate cannot reduce 112A tax.
    const only = NEW({ ltcg112A: 600000 });
    expect(only.specialLines[0].basicExemptionSetOff).toBe(400000);
    expect(only.rebate).toBe(0);
    expect(only.totalTax).toBe(9750);
  });

  it('new regime: exempt LTCG still counts toward the ₹12L rebate limit', () => {
    // Other 12L + LTCG 1L (fully within the 1.25L exemption) → TI 13L > 12L → no rebate.
    // Marginal relief: normal tax 60,000 < excess 1,00,000 → none. Tax 60,000 → 62,400.
    const b = NEW({ otherIncome: 1200000, ltcg112A: 100000 });
    expect(b.totalIncome).toBe(1300000);
    expect(b.rebate).toBe(0);
    expect(b.specialTax).toBe(0);
    expect(b.totalTax).toBe(62400);
  });

  it('old regime: 87A rebate is allowed against 111A tax', () => {
    // Other 1L, STCG 3L → TI 4L. Unused exemption 1.5L → STCG taxable 1.5L × 20% = 30,000.
    // Old rebate may reduce 111A tax: min(30,000, 12,500) → 17,500 → 18,200.
    const b = OLD({ otherIncome: 100000, stcg111A: 300000 });
    expect(b.rebate).toBe(12500);
    expect(b.totalTax).toBe(18200);
  });

  it('old regime: 87A rebate is not allowed against 112A tax', () => {
    // Other 1L, LTCG 4L → TI 5L. Set-off 1.5L → 2.5L; exemption 1.25L → 1.25L × 12.5% = 15,625.
    // Normal tax 0 so rebate 0 → 16,250.
    const b = OLD({ otherIncome: 100000, ltcg112A: 400000 });
    expect(b.rebate).toBe(0);
    expect(b.totalTax).toBe(16250);
  });

  it('surcharge on 111A tax capped at 15% when the rate is 25%', () => {
    // New: other 3Cr, STCG 1Cr → TI 4Cr → 25%. Normal tax 3,00,000 + 30% × 2,76,00,000 = 85,80,000;
    // STCG tax 20,00,000. Surcharge = 25% × 85,80,000 + 15% × 20,00,000 = 24,45,000.
    // Total (1,05,80,000 + 24,45,000) × 1.04 = 1,35,46,000.
    const b = NEW({ otherIncome: 30000000, stcg111A: 10000000 });
    expect(b.surcharge.gross).toBeCloseTo(2445000, 4);
    expect(b.totalTax).toBe(13546000);
  });

  it('surcharge on dividend tax capped at 15%', () => {
    // New: other 3Cr + dividends 1Cr = 4Cr slab income. Tax 3,00,000 + 30% × 3,76,00,000 = 1,15,80,000.
    // Dividend share = tax(4Cr) − tax(3Cr) = 30,00,000. Surcharge = 25% × 85,80,000 + 15% × 30,00,000 = 25,95,000.
    // Total (1,15,80,000 + 25,95,000) × 1.04 = 1,47,42,000.
    const b = NEW({ otherIncome: 30000000, dividends: 10000000 });
    expect(b.surcharge.gross).toBeCloseTo(2595000, 4);
    expect(b.totalTax).toBe(14742000);
  });
});

describe('rounding (288A / 288B)', () => {
  it('ignores paise, rounds to the nearest ₹10 (5 goes up), for both total income and tax', () => {
    expect(roundToNearest(1234564.9)).toBe(1234560);
    expect(roundToNearest(1234565)).toBe(1234570);
    expect(roundIncome(10394.9999999)).toBe(10400); // float noise for 10,395
    expect(roundTax(13002.08)).toBe(13000);
    expect(roundTax(-5)).toBe(0);
    // Old: 7,77,777 → TI 7,77,780. Tax 12,500 + 20% × 2,77,780 = 68,056 → × 1.04 = 70,778.24 → 70,780.
    const b = OLD({ otherIncome: 777777 });
    expect(b.totalIncome).toBe(777780);
    expect(b.totalTaxUnrounded).toBeCloseTo(70778.24, 6);
    expect(b.totalTax).toBe(70780);
  });
});

describe('regime comparison and year registry', () => {
  it('compareRegimes picks the lower tax', () => {
    // Old: 15L − HRA 2L − 50,000 = 12,50,000; HP −2L → 10,50,000; 80C 1.5L + 80CCD(1B) 50k + 80D 25k → 8,25,000.
    //      Tax 12,500 + 20% × 3,25,000 = 77,500 → 80,600.
    // New: 15L − 75,000 = 14,25,000. Tax 60,000 + 15% × 2,25,000 = 93,750 → 97,500.
    const cmp = compareRegimes(
      { age: 'below60', salary: 1500000, hraExemption: 200000, homeLoanInterest: 200000, c80: 150000, ccd1b: 50000, d80Self: 25000 },
      fy2025_26,
    );
    expect(cmp.old.totalTax).toBe(80600);
    expect(cmp.new.totalTax).toBe(97500);
    expect(cmp.better).toBe('old');
    expect(cmp.saving).toBe(16900);
  });

  it('every year is unverified; TY 2026-27 uses the 2025 Act and copies FY 2025-26 figures', () => {
    for (const y of taxYears) expect(y.verified.status).toBe('unverified');
    expect(getRules(defaultYearId)).toBe(fy2025_26);
    expect(ty2026_27.act).toBe('2025');
    expect(ty2026_27.label).toBe('Tax Year 2026-27');
    expect(ty2026_27.regimes).toEqual(fy2025_26.regimes);
    expect(computeTax({ age: 'below60', otherIncome: 1210000 }, ty2026_27).totalTax).toBe(10400);
  });

  it('slabFill: how ₹13L fills each new-regime slab', () => {
    // 0-4L: 4L at 0%; 4-8L: 4L → 20,000; 8-12L: 4L → 40,000; 12-16L: 1L → 15,000; higher slabs empty.
    // Slab tax 75,000; no rebate (> 12L); marginal relief none (75,000 < 1,00,000). Cess 3,000 → 78,000.
    const f = slabFill(1300000, 'new', fy2025_26);
    expect(f.slabs).toHaveLength(7);
    expect(f.slabs.map((s) => s.amountInSlab)).toEqual([400000, 400000, 400000, 100000, 0, 0, 0]);
    expect(f.slabs.map((s) => s.taxInSlab)).toEqual([0, 20000, 40000, 15000, 0, 0, 0]);
    expect(f.slabTax).toBe(75000);
    expect(f.totalTax).toBe(78000);
    expect(slabFill(1200000, 'new', fy2025_26).rebate).toBe(60000);
  });
});
