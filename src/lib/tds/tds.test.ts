import { describe, expect, it } from 'vitest';
import { computeTds, findTdsRow, rateFor, searchTds } from './tds';
import { tdsMeta, tdsRows } from './tds-rates';

const row = (s: string) => {
  const r = findTdsRow(s);
  if (!r) throw new Error(`missing ${s}`);
  return r;
};

describe('tds data', () => {
  it('is unverified and covers the required sections', () => {
    expect(tdsMeta.status).toBe('unverified');
    const required = [
      '192', '193', '194A', '194B', '194C', '194D', '194H', '194I(a)', '194I(b)', '194IA', '194IB',
      '194J(a)', '194J(b)', '194N', '194Q', '194O', '194S', '195',
    ];
    for (const s of required) expect(findTdsRow(s), s).toBeDefined();
  });

  it('has unique sections and a new-Act placeholder on every row', () => {
    expect(new Set(tdsRows.map((r) => r.section)).size).toBe(tdsRows.length);
    for (const r of tdsRows) expect(r.newActRef).toMatch(/TODO\(verify\)/);
  });

  it('uses 5% for no-PAN on 194O and 194Q', () => {
    expect(row('194O').noPan).toBe('5%');
    expect(row('194Q').noPan).toBe('5%');
  });
});

describe('searchTds', () => {
  it('returns everything for an empty query', () => {
    expect(searchTds('')).toHaveLength(tdsRows.length);
  });

  it('matches section prefixes, ignoring case and brackets', () => {
    expect(searchTds('194i').map((r) => r.section)).toEqual(['194I(a)', '194I(b)', '194IA', '194IB']);
    expect(searchTds('194J(b)').map((r) => r.section)).toEqual(['194J(b)']);
  });

  it('matches words in the nature and keywords', () => {
    expect(searchTds('rent').map((r) => r.section)).toEqual(expect.arrayContaining(['194I(a)', '194I(b)', '194IB']));
    expect(searchTds('fixed deposit').map((r) => r.section)).toContain('194A');
    expect(searchTds('crypto').map((r) => r.section)).toEqual(['194S']);
    expect(searchTds('zzz-no-match')).toEqual([]);
  });

  it('filters by category', () => {
    const rows = searchTds('', 'rent-property');
    expect(rows.every((r) => r.category === 'rent-property')).toBe(true);
    expect(searchTds('rent', 'interest')).toEqual([]);
  });
});

describe('computeTds', () => {
  it('194C: 1% for individuals, 2% for others', () => {
    expect(computeTds(row('194C'), 'individual', 150000)).toEqual({ rate: 1, base: 150000, tds: 1500, netPayable: 148500 });
    expect(computeTds(row('194C'), 'others', 150000)?.tds).toBe(3000);
  });

  it('194J(b) 10% rounds to the rupee', () => {
    // 55,555 × 10% = 5,555.5 → 5,556
    expect(computeTds(row('194J(b)'), 'individual', 55555)?.tds).toBe(5556);
  });

  it('0.1% for 194O without float drift', () => {
    // 12,34,567 × 0.1% = 1,234.567 → 1,235
    expect(computeTds(row('194O'), 'others', 1234567)?.tds).toBe(1235);
  });

  it('194Q charges only the amount above ₹50 lakh', () => {
    // (75,00,000 − 50,00,000) × 0.1% = 2,500
    expect(computeTds(row('194Q'), 'others', 7500000)).toMatchObject({ base: 2500000, tds: 2500 });
    expect(computeTds(row('194Q'), 'others', 4000000)).toMatchObject({ base: 0, tds: 0 });
  });

  it('returns null for variable-rate sections', () => {
    expect(computeTds(row('192'), 'individual', 1000000)).toBeNull();
    expect(computeTds(row('195'), 'others', 1000000)).toBeNull();
    expect(rateFor(row('195'), 'individual')).toBeNull();
  });

  it('zero or negative amounts give zero', () => {
    expect(computeTds(row('194H'), 'individual', 0)?.tds).toBe(0);
    expect(computeTds(row('194H'), 'individual', -5000)).toEqual({ rate: 2, base: 0, tds: 0, netPayable: 0 });
  });

  it('194D uses 10% for companies, 2% for firms and individuals', () => {
    // 1,00,000 × 10% = 10,000 (company); × 2% = 2,000 (firm / individual)
    expect(computeTds(row('194D'), 'company', 100000)?.tds).toBe(10000);
    expect(computeTds(row('194D'), 'others', 100000)?.tds).toBe(2000);
    expect(computeTds(row('194D'), 'individual', 100000)?.tds).toBe(2000);
    // sections without a separate company rate fall back to rateOthers
    expect(rateFor(row('194C'), 'company')).toBe(2);
  });
});
