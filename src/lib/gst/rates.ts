/**
 * GST rate list for the calculator. Data only: add or retire rates here, not in the UI.
 *
 * STATUS: UNVERIFIED. Written without internet access on 26 Sep 2026. Before shipping, check every rate
 * and example against the official rate schedules on https://cbic-gst.gov.in (and GST Council notifications).
 * The examples are indicative only. The rate for a specific item depends on its HSN/SAC classification.
 */

export type GstRateGroup = 'main' | 'special' | 'legacy';

export interface GstRate {
  /** Stable id used in the <select>. */
  id: string;
  /** Rate in percent, e.g. 18 for 18%. */
  rate: number;
  label: string;
  group: GstRateGroup;
  /** Short indicative examples. VERIFY. */
  examples?: string;
}

export const gstRatesMeta = {
  status: 'unverified' as const,
  checkedOn: '2026-09-26',
  /** GST 2.0 rate rationalisation effective date (VERIFY). */
  effectiveFrom: '2025-09-22',
  note:
    'Rates are unverified. Check the current rate for your HSN/SAC code on cbic-gst.gov.in before relying on them.',
};

export const gstRateGroups: Record<GstRateGroup, string> = {
  main: 'Main slabs (from 22 Sep 2025)',
  special: 'Special rates',
  legacy: 'Old slabs (pre-22 Sep 2025)',
};

export const gstRates: readonly GstRate[] = [
  // VERIFY: GST 2.0 main slabs, effective 22 Sep 2025.
  { id: '5', rate: 5, label: '5%', group: 'main', examples: 'Many essentials and everyday goods' },
  { id: '18', rate: 18, label: '18%', group: 'main', examples: 'Standard rate for most goods and services' },
  { id: '40', rate: 40, label: '40%', group: 'main', examples: 'Sin and luxury goods' },
  // VERIFY: special rates.
  { id: '0', rate: 0, label: '0% (nil / exempt)', group: 'special', examples: 'Nil-rated or exempt supplies' },
  { id: '0.25', rate: 0.25, label: '0.25%', group: 'special', examples: 'Rough precious and semi-precious stones' },
  { id: '3', rate: 3, label: '3%', group: 'special', examples: 'Gold, silver and jewellery' },
  // Legacy slabs: only for invoices dated before 22 Sep 2025. VERIFY.
  { id: '12-legacy', rate: 12, label: '12% (pre-22 Sep 2025)', group: 'legacy' },
  { id: '28-legacy', rate: 28, label: '28% (pre-22 Sep 2025)', group: 'legacy' },
];

export const defaultGstRateId = '18';

export function findGstRate(id: string): GstRate | undefined {
  return gstRates.find((r) => r.id === id);
}
