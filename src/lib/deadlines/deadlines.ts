/**
 * Indian tax compliance due dates, as data + a pure helper for the "next deadline" ticker.
 *
 * STATUS: VERIFY EVERYTHING. Written without internet access on 26 Sep 2026. CBDT and the GST Council often
 * extend due dates by notification or circular, and dates that fall on a holiday may move. These are the
 * usual statutory dates only, with no extensions and no weekend/holiday shifting. Check incometax.gov.in
 * and gst.gov.in before relying on any date.
 *
 * Dates are ISO strings (YYYY-MM-DD) so they are timezone-safe and sort as strings.
 */

export type DeadlineCategory = 'itr' | 'advance-tax' | 'gst' | 'tds';

export interface Deadline {
  /** Stable key, unique within a calendar year. */
  id: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  title: string;
  category: DeadlineCategory;
  note?: string;
}

export const deadlinesMeta = {
  status: 'unverified' as const,
  checkedOn: '2026-09-26',
  note: 'VERIFY: usual statutory due dates only. Extensions are often notified; check incometax.gov.in and gst.gov.in.',
};

export const deadlineCategoryLabels: Record<DeadlineCategory, string> = {
  itr: 'Income tax return',
  'advance-tax': 'Advance tax',
  gst: 'GST',
  tds: 'TDS',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CATEGORY_ORDER: DeadlineCategory[] = ['itr', 'advance-tax', 'tds', 'gst'];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
/** FY label for the year that ends in March of `endYear`, e.g. 2026 → "FY 2025-26". */
const fy = (endYear: number) => `FY ${endYear - 1}-${pad(endYear % 100)}`;
/** Month before (y, m), with m 1–12. */
const prev = (y: number, m: number) => (m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 });
const monthLabel = (y: number, m: number) => `${MONTHS[m - 1]} ${y}`;
/** Quarter that ended just before month m (m is Jan/Apr/Jul/Oct). */
const quarterBefore = (y: number, m: number) => {
  const end = prev(y, m);
  const start = end.m - 2;
  return `${MONTHS[start - 1]}–${MONTHS[end.m - 1]} ${end.y}`;
};

/** Every deadline dated within calendar year `year`, unsorted. */
export function deadlinesForYear(year: number): Deadline[] {
  const out: Deadline[] = [];
  const add = (m: number, d: number, key: string, title: string, category: DeadlineCategory, note?: string) =>
    out.push({ id: `${iso(year, m, d)}-${key}`, date: iso(year, m, d), title, category, note });

  for (let m = 1; m <= 12; m++) {
    const p = prev(year, m);
    const quarterEnd = m === 1 || m === 4 || m === 7 || m === 10;

    // TDS deposit: 7th of next month; March deductions by 30 April instead of 7 April.
    if (m !== 4) {
      add(m, 7, 'tds-pay', `TDS payment for ${monthLabel(p.y, p.m)}`, 'tds', 'Tax deducted in the previous month. VERIFY.');
    } else {
      add(4, 30, 'tds-pay', `TDS payment for ${monthLabel(p.y, p.m)}`, 'tds', 'March deductions are due by 30 April. VERIFY.');
    }

    add(m, 11, 'gstr1', `GSTR-1 (monthly) for ${monthLabel(p.y, p.m)}`, 'gst', 'Monthly filers. VERIFY.');
    if (quarterEnd) {
      add(m, 13, 'gstr1-qrmp', `GSTR-1 (quarterly, QRMP) for ${quarterBefore(year, m)}`, 'gst', 'QRMP filers. VERIFY.');
    } else {
      add(m, 13, 'iff', `IFF (optional) for ${monthLabel(p.y, p.m)}`, 'gst', 'Invoice Furnishing Facility for QRMP filers. VERIFY.');
    }
    add(m, 20, 'gstr3b', `GSTR-3B (monthly) for ${monthLabel(p.y, p.m)}`, 'gst', 'Monthly filers. VERIFY.');
    if (quarterEnd) {
      add(
        m,
        22,
        'gstr3b-qrmp',
        `GSTR-3B (quarterly, QRMP) for ${quarterBefore(year, m)}`,
        'gst',
        '22nd or 24th depending on your state. VERIFY.',
      );
    }
  }

  // Advance tax: instalments for the FY that ends in March of `year` (Mar) or `year + 1` (Jun/Sep/Dec).
  add(3, 15, 'adv-4', `Advance tax: 4th instalment (100%) for ${fy(year)}`, 'advance-tax', 'Also the single instalment for 44AD/44ADA. VERIFY.');
  add(6, 15, 'adv-1', `Advance tax: 1st instalment (15%) for ${fy(year + 1)}`, 'advance-tax', 'VERIFY.');
  add(9, 15, 'adv-2', `Advance tax: 2nd instalment (45%) for ${fy(year + 1)}`, 'advance-tax', 'VERIFY.');
  add(12, 15, 'adv-3', `Advance tax: 3rd instalment (75%) for ${fy(year + 1)}`, 'advance-tax', 'VERIFY.');

  // Quarterly TDS returns (24Q/26Q/27Q).
  add(1, 31, 'tds-q3', `TDS return for Oct–Dec ${year - 1} (Q3, ${fy(year)})`, 'tds', 'Forms 24Q/26Q/27Q. VERIFY.');
  add(5, 31, 'tds-q4', `TDS return for Jan–Mar ${year} (Q4, ${fy(year)})`, 'tds', 'Forms 24Q/26Q/27Q. VERIFY.');
  add(7, 31, 'tds-q1', `TDS return for Apr–Jun ${year} (Q1, ${fy(year + 1)})`, 'tds', 'Forms 24Q/26Q/27Q. VERIFY.');
  add(10, 31, 'tds-q2', `TDS return for Jul–Sep ${year} (Q2, ${fy(year + 1)})`, 'tds', 'Forms 24Q/26Q/27Q. VERIFY.');
  add(6, 15, 'form16', `Form 16 to employees for ${fy(year)}`, 'tds', 'Employers issue Form 16 (salary TDS certificate). VERIFY.');

  // Income tax returns for the FY that ended in March of `year`.
  add(7, 31, 'itr', `ITR due date (no audit) for ${fy(year)}`, 'itr', 'Most salaried people and others not needing a tax audit. Often extended; VERIFY.');
  add(10, 31, 'itr-audit', `ITR due date (tax audit cases) for ${fy(year)}`, 'itr', 'Taxpayers whose accounts need an audit. VERIFY.');
  add(12, 31, 'itr-belated', `Belated or revised ITR for ${fy(year)}`, 'itr', 'Last date for a belated or revised return; a late fee may apply. VERIFY.');

  // GST annual return.
  add(12, 31, 'gstr9', `GSTR-9 annual return for ${fy(year)}`, 'gst', 'Annual return; small taxpayers may be exempt. VERIFY.');

  return out;
}

function compare(a: Deadline, b: Deadline): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const c = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  return c !== 0 ? c : a.title.localeCompare(b.title);
}

/** Local calendar date of a Date, or a validated YYYY-MM-DD string. */
export function toIsoDate(d: Date | string): string {
  if (typeof d === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new RangeError(`Expected YYYY-MM-DD, got "${d}"`);
    return d;
  }
  if (Number.isNaN(d.getTime())) throw new RangeError('Invalid date');
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * The next `count` deadlines on or after `from` (inclusive), sorted by date. Rolls over months and years.
 * Optionally limited to some categories.
 */
export function upcomingDeadlines(
  from: Date | string,
  count = 5,
  categories?: readonly DeadlineCategory[],
): Deadline[] {
  const start = toIsoDate(from);
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const allow = categories && categories.length ? new Set(categories) : null;

  const out: Deadline[] = [];
  let year = Number(start.slice(0, 4));
  // Each year has dozens of entries; a few years always covers any sensible count.
  for (let guard = 0; out.length < n && guard < 50; guard++, year++) {
    const items = deadlinesForYear(year)
      .filter((d) => d.date >= start && (!allow || allow.has(d.category)))
      .sort(compare);
    out.push(...items);
  }
  return out.slice(0, n);
}

/** "7 Oct 2026" */
export function formatDeadlineDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Whole days from `from` to `isoDate` (0 = today). */
export function daysUntil(from: Date | string, isoDate: string): number {
  const utc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(isoDate) - utc(toIsoDate(from))) / 86400000);
}
