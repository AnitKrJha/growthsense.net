import type { Slab, TaxRules } from '../types';

/**
 * FY 2025-26 (AY 2026-27), Income-tax Act, 1961, as amended by the Finance Act 2025.
 *
 * Drafted from the handoff brief and the Finance Act 2025 as recalled offline. NOT verified:
 * internet access was blocked while this was written. Every figure must be checked against the
 * official Income Tax Department calculator (incometax.gov.in) before launch.
 */

const NEW_SLABS: Slab[] = [
  { upTo: 400000, rate: 0 },
  { upTo: 800000, rate: 0.05 },
  { upTo: 1200000, rate: 0.1 },
  { upTo: 1600000, rate: 0.15 },
  { upTo: 2000000, rate: 0.2 },
  { upTo: 2400000, rate: 0.25 },
  { upTo: null, rate: 0.3 },
];

const OLD_TAIL: Slab[] = [
  { upTo: 1000000, rate: 0.2 },
  { upTo: null, rate: 0.3 },
];

export const fy2025_26: TaxRules = {
  id: 'fy2025-26',
  label: 'FY 2025-26 (AY 2026-27)',
  shortLabel: 'FY 2025-26',
  act: '1961',
  sectionLabels: {
    standardDeduction: 's. 16(ia)',
    hra: 's. 10(13A)',
    houseProperty: 's. 24',
    selfOccupiedInterest: 's. 24(b)',
    familyPension: 's. 57(iia)',
    c80: 's. 80C',
    ccd1b: 's. 80CCD(1B)',
    ccd2: 's. 80CCD(2)',
    d80: 's. 80D',
    tta: 's. 80TTA',
    ttb: 's. 80TTB',
    rebate: 's. 87A',
    stcg: 's. 111A',
    ltcg: 's. 112A',
    roundIncome: 's. 288A',
    roundTax: 's. 288B',
    newRegime: 's. 115BAC',
  },
  verified: {
    status: 'unverified',
    note: 'Drafted from the Finance Act 2025 without access to official sources. Verify against the official Income Tax Department calculator before launch.',
    date: null,
  },
  regimes: {
    new: {
      slabs: { below60: NEW_SLABS, '60to79': NEW_SLABS, '80plus': NEW_SLABS },
      standardDeduction: 75000,
      familyPension: { fraction: 1 / 3, cap: 25000 },
      rebate: { incomeLimit: 1200000, maxRebate: 60000, marginalRelief: true, notAgainst: ['111A', '112A'] },
      // New regime: surcharge capped at 25% (no 37% tier).
      surcharge: [
        { above: 5000000, rate: 0.1 },
        { above: 10000000, rate: 0.15 },
        { above: 20000000, rate: 0.25 },
      ],
      employerNpsPct: 0.14,
      allows: { hraExemption: false, selfOccupiedInterest: false, chapterVIA: false },
    },
    old: {
      slabs: {
        below60: [{ upTo: 250000, rate: 0 }, { upTo: 500000, rate: 0.05 }, ...OLD_TAIL],
        '60to79': [{ upTo: 300000, rate: 0 }, { upTo: 500000, rate: 0.05 }, ...OLD_TAIL],
        '80plus': [{ upTo: 500000, rate: 0 }, ...OLD_TAIL],
      },
      standardDeduction: 50000,
      familyPension: { fraction: 1 / 3, cap: 15000 },
      // Old regime: 87A rebate is not allowed against tax on 112A gains (s.112A(6)); allowed against 111A.
      rebate: { incomeLimit: 500000, maxRebate: 12500, marginalRelief: false, notAgainst: ['112A'] },
      surcharge: [
        { above: 5000000, rate: 0.1 },
        { above: 10000000, rate: 0.15 },
        { above: 20000000, rate: 0.25 },
        { above: 50000000, rate: 0.37 },
      ],
      employerNpsPct: 0.1,
      allows: { hraExemption: true, selfOccupiedInterest: true, chapterVIA: true },
    },
  },
  special: {
    stcg111ARate: 0.2,
    ltcg112ARate: 0.125,
    ltcg112AExemption: 125000,
    surchargeCap: 0.15,
  },
  cessRate: 0.04,
  caps: {
    c80: 150000,
    ccd1b: 50000,
    d80SelfBelow60: 25000,
    d80SelfSenior: 50000,
    d80ParentsBelow60: 25000,
    d80ParentsSenior: 50000,
    tta: 10000,
    ttb: 50000,
    selfOccupiedInterest: 200000,
    houseStandardDeductionPct: 0.3,
  },
  rounding: { income: 10, tax: 10 },
};
