import type { TaxRules, YearId } from '../types';
import { fy2025_26 } from './fy2025-26';
import { ty2026_27 } from './ty2026-27';

/** Year registry, oldest first (UI order). Adding a year = one new rules file + one entry here + tests. */
export const taxYears: TaxRules[] = [fy2025_26, ty2026_27];

/** FY 2025-26 is the year currently being filed, so it is the default selection. */
export const defaultYearId: YearId = 'fy2025-26';

export function getRules(id: YearId): TaxRules {
  const r = taxYears.find((y) => y.id === id);
  if (!r) throw new Error(`Unknown tax year: ${id}`);
  return r;
}

export { fy2025_26, ty2026_27 };
