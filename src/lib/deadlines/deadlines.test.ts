import { describe, expect, it } from 'vitest';
import { daysUntil, deadlinesForYear, deadlinesMeta, formatDeadlineDate, toIsoDate, upcomingDeadlines } from './deadlines';

const brief = (list: ReturnType<typeof upcomingDeadlines>) => list.map((d) => `${d.date} ${d.title}`);

describe('upcomingDeadlines', () => {
  it('next five from 26 Sep 2026', () => {
    expect(brief(upcomingDeadlines('2026-09-26', 5))).toEqual([
      '2026-10-07 TDS payment for Sep 2026',
      '2026-10-11 GSTR-1 (monthly) for Sep 2026',
      '2026-10-13 GSTR-1 (quarterly, QRMP) for Jul–Sep 2026',
      '2026-10-20 GSTR-3B (monthly) for Sep 2026',
      '2026-10-22 GSTR-3B (quarterly, QRMP) for Jul–Sep 2026',
    ]);
  });

  it('includes the start date itself', () => {
    const [first] = upcomingDeadlines('2026-09-15', 1);
    expect(first.title).toBe('Advance tax: 2nd instalment (45%) for FY 2026-27');
    expect(first.category).toBe('advance-tax');
  });

  it('rolls over into the next year, same-day items ordered by category', () => {
    expect(brief(upcomingDeadlines('2026-12-25', 3))).toEqual([
      '2026-12-31 Belated or revised ITR for FY 2025-26',
      '2026-12-31 GSTR-9 annual return for FY 2025-26',
      '2027-01-07 TDS payment for Dec 2026',
    ]);
  });

  it('April: no TDS payment on the 7th, March TDS due 30 April', () => {
    const april = upcomingDeadlines('2027-04-01', 6);
    expect(brief(april)).toEqual([
      '2027-04-11 GSTR-1 (monthly) for Mar 2027',
      '2027-04-13 GSTR-1 (quarterly, QRMP) for Jan–Mar 2027',
      '2027-04-20 GSTR-3B (monthly) for Mar 2027',
      '2027-04-22 GSTR-3B (quarterly, QRMP) for Jan–Mar 2027',
      '2027-04-30 TDS payment for Mar 2027',
      '2027-05-07 TDS payment for Apr 2027',
    ]);
  });

  it('January labels the previous year correctly', () => {
    const jan = upcomingDeadlines('2027-01-01', 20).filter((d) => d.date.startsWith('2027-01'));
    expect(jan.map((d) => d.title)).toEqual(
      expect.arrayContaining([
        'GSTR-1 (quarterly, QRMP) for Oct–Dec 2026',
        'GSTR-3B (monthly) for Dec 2026',
        'TDS return for Oct–Dec 2026 (Q3, FY 2026-27)',
      ]),
    );
  });

  it('filters by category', () => {
    expect(brief(upcomingDeadlines('2026-09-26', 4, ['itr', 'advance-tax']))).toEqual([
      '2026-10-31 ITR due date (tax audit cases) for FY 2025-26',
      '2026-12-15 Advance tax: 3rd instalment (75%) for FY 2026-27',
      '2026-12-31 Belated or revised ITR for FY 2025-26',
      '2027-03-15 Advance tax: 4th instalment (100%) for FY 2026-27',
    ]);
  });

  it('is sorted, sized and accepts a Date', () => {
    const list = upcomingDeadlines(new Date(2026, 6, 1), 40);
    expect(list).toHaveLength(40);
    const dates = list.map((d) => d.date);
    expect([...dates].sort()).toEqual(dates);
    expect(dates[0] >= '2026-07-01').toBe(true);
    expect(new Set(list.map((d) => d.id)).size).toBe(40);
  });

  it('count 0 or negative gives an empty list; bad dates throw', () => {
    expect(upcomingDeadlines('2026-09-26', 0)).toEqual([]);
    expect(upcomingDeadlines('2026-09-26', -3)).toEqual([]);
    expect(() => upcomingDeadlines('26/09/2026', 3)).toThrow(RangeError);
    expect(() => upcomingDeadlines(new Date('nope'), 3)).toThrow(RangeError);
  });
});

describe('deadlinesForYear', () => {
  const y2026 = deadlinesForYear(2026);
  const on = (date: string) => y2026.filter((d) => d.date === date).map((d) => d.title);

  it('has the yearly income tax dates', () => {
    expect(on('2026-07-31')).toEqual(
      expect.arrayContaining(['ITR due date (no audit) for FY 2025-26', 'TDS return for Apr–Jun 2026 (Q1, FY 2026-27)']),
    );
    expect(on('2026-06-15')).toEqual(
      expect.arrayContaining(['Advance tax: 1st instalment (15%) for FY 2026-27', 'Form 16 to employees for FY 2025-26']),
    );
    expect(on('2026-05-31')).toEqual(['TDS return for Jan–Mar 2026 (Q4, FY 2025-26)']);
    expect(on('2026-03-15')).toEqual(['Advance tax: 4th instalment (100%) for FY 2025-26']);
  });

  it('has 11 monthly TDS payments on the 7th plus 30 April', () => {
    const pays = y2026.filter((d) => d.id.endsWith('tds-pay'));
    expect(pays).toHaveLength(12);
    expect(pays.filter((d) => d.date.endsWith('-07'))).toHaveLength(11);
    expect(pays.some((d) => d.date === '2026-04-30')).toBe(true);
  });

  it('IFF in non-quarter-end months, QRMP GSTR-1 in quarter-end months', () => {
    expect(y2026.filter((d) => d.id.endsWith('-iff'))).toHaveLength(8);
    expect(y2026.filter((d) => d.id.endsWith('gstr1-qrmp')).map((d) => d.date)).toEqual([
      '2026-01-13',
      '2026-04-13',
      '2026-07-13',
      '2026-10-13',
    ]);
  });

  it('every entry is marked VERIFY', () => {
    expect(deadlinesMeta.status).toBe('unverified');
    for (const d of y2026) expect(d.note).toMatch(/VERIFY/);
  });
});

describe('helpers', () => {
  it('formats and counts days', () => {
    expect(formatDeadlineDate('2026-10-07')).toBe('7 Oct 2026');
    expect(daysUntil('2026-09-26', '2026-10-07')).toBe(11);
    expect(daysUntil('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysUntil('2026-09-26', '2026-09-26')).toBe(0);
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
