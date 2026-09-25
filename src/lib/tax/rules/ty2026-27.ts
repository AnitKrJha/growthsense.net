import type { TaxRules } from '../types';
import { fy2025_26 } from './fy2025-26';

/**
 * Tax Year 2026-27 (1 Apr 2026 to 31 Mar 2027), Income-tax Act, 2025.
 *
 * PLACEHOLDER: every rate, slab, limit and cap below is COPIED UNCHANGED from FY 2025-26.
 * Budget 2026 / Finance Act 2026 changes (if any) could not be checked offline. Status stays
 * 'unverified' until someone confirms each figure against official sources.
 *
 * Section numbers: the 2025 Act renumbers every provision. The new section numbers were not
 * verified, so labels below point to the 1961 Act equivalent ("old 87A" etc.) instead of
 * guessing. TODO(verify): replace each with the Income-tax Act, 2025 section number.
 */
export const ty2026_27: TaxRules = {
  ...fy2025_26,
  id: 'ty2026-27',
  label: 'Tax Year 2026-27',
  shortLabel: 'TY 2026-27',
  act: '2025',
  sectionLabels: {
    standardDeduction: 'old s. 16(ia)', // TODO(verify) new-Act section
    hra: 'old s. 10(13A)', // TODO(verify)
    houseProperty: 'old s. 24', // TODO(verify)
    selfOccupiedInterest: 'old s. 24(b)', // TODO(verify)
    familyPension: 'old s. 57(iia)', // TODO(verify)
    c80: 'old s. 80C', // TODO(verify)
    ccd1b: 'old s. 80CCD(1B)', // TODO(verify)
    ccd2: 'old s. 80CCD(2)', // TODO(verify)
    d80: 'old s. 80D', // TODO(verify)
    tta: 'old s. 80TTA', // TODO(verify)
    ttb: 'old s. 80TTB', // TODO(verify)
    rebate: 'old s. 87A', // TODO(verify)
    stcg: 'old s. 111A', // TODO(verify)
    ltcg: 'old s. 112A', // TODO(verify)
    roundIncome: 'old s. 288A', // TODO(verify)
    roundTax: 'old s. 288B', // TODO(verify)
    newRegime: 'old s. 115BAC', // TODO(verify)
  },
  verified: {
    status: 'unverified',
    note: 'Figures copied from FY 2025-26; any Budget 2026 / Finance Act 2026 changes are not reflected. Verify against the official Income Tax Department calculator before launch.',
    date: null,
  },
};
