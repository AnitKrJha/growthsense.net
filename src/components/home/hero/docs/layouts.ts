/**
 * The tax documents drawn on the hero's papers, as renderer-agnostic primitives in a 400 × 566 logical space
 * (A4 portrait, y down). The same layouts feed the WebGL canvas textures (canvas.ts) and the build-time SVG
 * poster (svg.ts), so the static and live heroes always show the same paperwork.
 *
 * All data is deliberately generic: masked PANs (XXXXX1234X), dotted amounts (₹ ••,•••), no real names.
 */
import type { DocKind } from '../engine/config';
import { C } from './palette';

export const DOC_W = 400;
export const DOC_H = 566;

export type Font = 'mono' | 'text' | 'display';

export type Prim =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number; dash?: number[]; r?: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number; dash?: number[] }
  | { t: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number; dash?: number[] }
  | {
      t: 'text';
      x: number;
      y: number;
      s: string;
      size: number;
      font: Font;
      weight?: number;
      fill: string;
      anchor?: 'start' | 'middle' | 'end';
      /** Letter spacing in em. */
      ls?: number;
      /** Rotation in degrees about (x, y). */
      rot?: number;
    };

export interface DocLayout {
  kind: DocKind | 'ack';
  /** Accessible-ish name, used for the poster's <title> and debugging. */
  name: string;
  bg: string;
  prims: Prim[];
}

/* ─── tiny builder ──────────────────────────────────────────────────────────────────────────────────── */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Doc {
  prims: Prim[] = [];
  rand: () => number;
  constructor(seed: number) {
    this.rand = rng(seed);
  }
  rect(x: number, y: number, w: number, h: number, o: Partial<Extract<Prim, { t: 'rect' }>> = {}) {
    this.prims.push({ t: 'rect', x, y, w, h, stroke: C.ink2, sw: 0.8, ...o });
    return this;
  }
  fill(x: number, y: number, w: number, h: number, fill: string, r = 0) {
    this.prims.push({ t: 'rect', x, y, w, h, fill, r });
    return this;
  }
  line(x1: number, y1: number, x2: number, y2: number, stroke: string = C.ink2, sw = 0.8, dash?: number[]) {
    this.prims.push({ t: 'line', x1, y1, x2, y2, stroke, sw, dash });
    return this;
  }
  text(x: number, y: number, s: string, size: number, o: Partial<Extract<Prim, { t: 'text' }>> = {}) {
    this.prims.push({ t: 'text', x, y, s, size, font: 'text', fill: C.ink, ...o });
    return this;
  }
  mono(x: number, y: number, s: string, size: number, o: Partial<Extract<Prim, { t: 'text' }>> = {}) {
    return this.text(x, y, s, size, { font: 'mono', ...o });
  }
  /** Abstracted lines of body text: rounded grey bars of varied length. */
  bars(x: number, y: number, maxW: number, count: number, gap = 9, h = 3.2, colour: string = C.paperLine) {
    for (let i = 0; i < count; i++) {
      const last = i === count - 1;
      const w = maxW * (last ? 0.35 + this.rand() * 0.3 : 0.72 + this.rand() * 0.28);
      this.fill(x, y + i * gap, w, h, colour, h / 2);
    }
    return this;
  }
  /** A labelled field box: tiny pencil label on top, value underneath. */
  field(x: number, y: number, w: number, h: number, label: string, value?: string, mono = true) {
    this.rect(x, y, w, h, { stroke: C.ink2, sw: 0.7 });
    this.text(x + 5, y + 10, label, 6.4, { fill: C.pencil, weight: 500 });
    if (value) {
      if (mono) this.mono(x + 5, y + h - 8, value, 8.6, { weight: 600, ls: 0.04 });
      else this.text(x + 5, y + h - 8, value, 8.6, { weight: 600 });
    } else {
      this.bars(x + 5, y + 16, w - 14, Math.max(1, Math.floor((h - 18) / 8)), 8, 2.6);
    }
    return this;
  }
  /** Character boxes (PAN / assessment year style). */
  charBoxes(x: number, y: number, chars: string, box = 12, h = 15) {
    [...chars].forEach((ch, i) => {
      this.rect(x + i * box, y, box, h, { stroke: C.ink2, sw: 0.6 });
      if (ch !== ' ') this.mono(x + i * box + box / 2, y + h - 4, ch, 8, { anchor: 'middle', weight: 600 });
    });
    return this;
  }
  /** A ruled table. `cols` are widths; `rows` are cell strings ('' = bar placeholder). */
  table(x: number, y: number, cols: number[], header: string[], rows: (string | undefined)[][], o: { rowH?: number; headH?: number; bold?: number[]; head?: string } = {}) {
    const rowH = o.rowH ?? 17;
    const headH = o.headH ?? 22;
    const W = cols.reduce((a, b) => a + b, 0);
    const H = headH + rows.length * rowH;
    this.fill(x, y, W, headH, o.head ?? C.paperTint);
    this.rect(x, y, W, H, { stroke: C.ink2, sw: 0.8 });
    let cx = x;
    cols.forEach((w, ci) => {
      if (ci > 0) this.line(cx, y, cx, y + H, C.ink2, 0.5);
      const label = header[ci] ?? '';
      const lines = wrap(label, Math.max(6, Math.floor(w / 3.5)));
      lines.slice(0, 2).forEach((ln, li) =>
        this.text(cx + 4, y + (lines.length > 1 ? 9 : 13) + li * 8, ln, 6.2, { weight: 650, fill: C.ink2 }),
      );
      cx += w;
    });
    rows.forEach((row, ri) => {
      const ry = y + headH + ri * rowH;
      this.line(x, ry, x + W, ry, C.ink2, ri === 0 ? 0.8 : 0.35);
      let rx = x;
      cols.forEach((w, ci) => {
        const cell = row[ci];
        const bold = o.bold?.includes(ri);
        if (cell === undefined) {
          /* empty */
        } else if (cell === '') {
          this.fill(rx + 4, ry + rowH / 2 - 1.4, w * (0.45 + this.rand() * 0.4), 2.8, C.paperLine, 1.4);
        } else {
          const numeric = /^[₹\d•,.\-\s%()]+$/.test(cell) && ci > 0;
          this.mono(numeric ? rx + w - 4 : rx + 4, ry + rowH - 5.5, cell, 7, {
            anchor: numeric ? 'end' : 'start',
            weight: bold ? 700 : 500,
            fill: bold ? C.ink : C.ink2,
          });
        }
        rx += w;
      });
    });
    return y + H;
  }
  build(kind: DocLayout['kind'], name: string, bg: string = C.paper): DocLayout {
    return { kind, name, bg, prims: this.prims };
  }
}

function wrap(s: string, max: number): string[] {
  const words = s.split(' ');
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

const M = 24; // page margin
const IW = DOC_W - M * 2; // inner width 352

/** Common header: title, sub-title and an optional band. Returns the next y. */
function header(d: Doc, title: string, sub?: string, band?: string) {
  d.mono(DOC_W / 2, 42, title, 15, { anchor: 'middle', weight: 750, ls: 0.06 });
  let y = 42;
  if (sub) {
    d.text(DOC_W / 2, 56, sub, 7.4, { anchor: 'middle', fill: C.pencil });
    y = 56;
  }
  if (band) {
    d.fill(M, y + 10, IW, 16, C.paperTint);
    d.mono(DOC_W / 2, y + 21.5, band, 7.6, { anchor: 'middle', weight: 700, ls: 0.12 });
    y += 26;
  }
  return y + 12;
}

function signature(d: Doc, y: number, label: string) {
  d.line(DOC_W - M - 130, y, DOC_W - M, y, C.ink2, 0.6);
  d.prims.push({ t: 'line', x1: DOC_W - M - 118, y1: y - 6, x2: DOC_W - M - 40, y2: y - 12, stroke: C.carbon, sw: 1.1 });
  d.prims.push({ t: 'line', x1: DOC_W - M - 60, y1: y - 12, x2: DOC_W - M - 22, y2: y - 4, stroke: C.carbon, sw: 1.1 });
  d.text(DOC_W - M, y + 10, label, 6.2, { anchor: 'end', fill: C.pencil });
}

function foot(d: Doc, s: string) {
  d.line(M, DOC_H - 30, DOC_W - M, DOC_H - 30, C.paperLine, 0.8);
  d.mono(M, DOC_H - 18, s, 6, { fill: C.faint, ls: 0.06 });
  d.mono(DOC_W - M, DOC_H - 18, 'Page 1 of 1', 6, { fill: C.faint, anchor: 'end' });
}

/* ─── documents ─────────────────────────────────────────────────────────────────────────────────────── */

function form16(): DocLayout {
  const d = new Doc(16);
  let y = header(d, 'FORM NO. 16', '[See rule 31(1)(a)]', 'PART A');
  d.text(DOC_W / 2, y + 2, 'Certificate under section 203 of the Income-tax Act, 1961', 8, { anchor: 'middle', weight: 600 });
  d.text(DOC_W / 2, y + 13, 'for tax deducted at source on salary', 8, { anchor: 'middle', weight: 600 });
  y += 24;
  d.field(M, y, IW / 2, 50, 'Name and address of the Employer');
  d.field(M + IW / 2, y, IW / 2, 50, 'Name and address of the Employee');
  y += 50;
  const w3 = IW / 3;
  d.field(M, y, w3, 30, 'PAN of the Deductor', 'XXXXX1234X');
  d.field(M + w3, y, w3, 30, 'TAN of the Deductor', 'XXXX12345X');
  d.field(M + w3 * 2, y, w3, 30, 'PAN of the Employee', 'XXXXX5678X');
  y += 30;
  d.field(M, y, w3, 30, 'CIT (TDS)');
  d.field(M + w3, y, w3, 30, 'Assessment Year', '2026-27');
  d.field(M + w3 * 2, y, w3, 30, 'Period with the Employer', 'Apr 25 – Mar 26');
  y += 44;
  d.text(M, y, 'Summary of amount paid/credited and tax deducted at source thereon', 7.4, { weight: 650 });
  y += 8;
  y = d.table(
    M,
    y,
    [52, 92, 72, 68, 68],
    ['Quarter', 'Receipt numbers of original statements', 'Amount paid / credited', 'Tax deducted', 'Tax deposited'],
    [
      ['Q1', 'QVX••••••', '₹ •,••,•••', '₹ ••,•••', '₹ ••,•••'],
      ['Q2', 'QVX••••••', '₹ •,••,•••', '₹ ••,•••', '₹ ••,•••'],
      ['Q3', 'QVX••••••', '₹ •,••,•••', '₹ ••,•••', '₹ ••,•••'],
      ['Q4', 'QVX••••••', '₹ •,••,•••', '₹ ••,•••', '₹ ••,•••'],
      ['Total', '', '₹ ••,••,•••', '₹ •,••,•••', '₹ •,••,•••'],
    ],
    { bold: [4] },
  );
  y += 16;
  d.fill(M, y, IW, 16, C.paperTint);
  d.mono(DOC_W / 2, y + 11.5, 'PART B (ANNEXURE)', 7.6, { anchor: 'middle', weight: 700, ls: 0.12 });
  y += 26;
  const rows = ['Gross salary', 'Less: allowances exempt u/s 10', 'Standard deduction u/s 16(ia)', 'Income chargeable under "Salaries"', 'Total taxable income', 'Tax on total income'];
  rows.forEach((r, i) => {
    d.text(M + 4, y + i * 15, `${i + 1}.  ${r}`, 7, { fill: C.ink2 });
    d.line(M + 190, y + i * 15 + 2, DOC_W - M - 70, y + i * 15 + 2, C.paperLine, 0.8, [1.5, 2.5]);
    d.mono(DOC_W - M - 4, y + i * 15, '₹ ••,••,•••', 7, { anchor: 'end', weight: 600 });
  });
  y += rows.length * 15 + 14;
  d.text(M, y, 'Verification', 7.6, { weight: 700 });
  d.bars(M, y + 8, IW - 20, 2, 8, 2.6);
  signature(d, DOC_H - 50, 'Signature of person responsible for deduction of tax');
  foot(d, 'TRACES · CERTIFICATE NO. ••••••');
  return d.build('form16', 'Form 16');
}

function ais(): DocLayout {
  const d = new Doc(26);
  d.fill(0, 0, DOC_W, 58, C.forestDeep);
  d.text(M, 28, 'Annual Information Statement (AIS)', 13.5, { font: 'display', weight: 700, fill: C.paper });
  d.mono(M, 45, 'FINANCIAL YEAR 2025-26 · ASSESSMENT YEAR 2026-27', 6.6, { fill: '#aec4b7', ls: 0.08 });
  let y = 80;
  d.text(M, y, 'Part A  General Information', 8.4, { weight: 700 });
  y += 8;
  d.field(M, y, IW / 2, 30, 'Permanent Account Number (PAN)', 'XXXXX1234X');
  d.field(M + IW / 2, y, IW / 2, 30, 'Aadhaar Number', 'XXXX XXXX 1234');
  y += 30;
  d.field(M, y, IW / 2, 30, 'Name of the Assessee', '••••• •••••', false);
  d.field(M + IW / 2, y, IW / 2, 30, 'Date of Birth', '••/••/19••');
  y += 46;
  d.text(M, y, 'Part B1  Information relating to TDS / TCS', 8.4, { weight: 700 });
  y += 8;
  y = d.table(
    M,
    y,
    [28, 88, 132, 104],
    ['Sr.', 'Information code', 'Information description', 'Amount'],
    [
      ['1', 'TDS-192', 'Salary', '₹ ••,••,•••'],
      ['2', 'TDS-194A', 'Interest other than securities', '₹ ••,•••'],
      ['3', 'TDS-194J', 'Fees for professional services', '₹ •,••,•••'],
    ],
  );
  y += 16;
  d.text(M, y, 'Part B2  Specified Financial Transactions (SFT)', 8.4, { weight: 700 });
  y += 8;
  y = d.table(
    M,
    y,
    [28, 88, 132, 104],
    ['Sr.', 'Information code', 'Information description', 'Amount'],
    [
      ['1', 'SFT-005', 'Time deposits', '₹ •,••,•••'],
      ['2', 'SFT-016', 'Interest income', '₹ ••,•••'],
      ['3', 'SFT-015', 'Dividend income', '₹ •,•••'],
      ['4', 'SFT-017', 'Sale of securities and units', '₹ •,••,•••'],
    ],
  );
  y += 16;
  d.text(M, y, 'Part B3  Payment of taxes', 8.4, { weight: 700 });
  d.bars(M, y + 10, IW, 4, 9, 3);
  d.fill(M, DOC_H - 74, IW, 28, C.mint, 3);
  d.text(M + 10, DOC_H - 56, 'Feedback can be submitted on the compliance portal.', 7, { fill: C.forestDeep, weight: 600 });
  foot(d, 'AIS · GENERATED ON ••/••/2026');
  return d.build('ais', 'Annual Information Statement');
}

function gstr3b(): DocLayout {
  const d = new Doc(3);
  let y = header(d, 'FORM GSTR-3B', '[See rule 61(5)]');
  d.field(M, y, IW * 0.6, 30, '1. GSTIN', '••AAAAA0000A1Z•');
  d.field(M + IW * 0.6, y, IW * 0.4, 30, 'Period', 'Aug 2026');
  y += 30;
  d.field(M, y, IW, 30, '2(a). Legal name of the registered person', '•••••• TRADERS', false);
  y += 44;
  d.text(M, y, '3.1 Details of outward supplies and inward supplies liable to reverse charge', 7.2, { weight: 700 });
  y += 8;
  y = d.table(
    M,
    y,
    [112, 56, 46, 46, 46, 46],
    ['Nature of supplies', 'Total taxable value', 'Integrated tax', 'Central tax', 'State/UT tax', 'Cess'],
    [
      ['(a) Outward taxable', '••,•••', '•,•••', '•,•••', '•,•••', '0'],
      ['(b) Zero rated', '0', '0', '', '', '0'],
      ['(c) Nil rated, exempted', '•,•••', '', '', '', ''],
      ['(d) Inward (reverse charge)', '•••', '••', '••', '••', '0'],
      ['(e) Non-GST outward', '0', '', '', '', ''],
    ],
    { headH: 26 },
  );
  y += 18;
  d.text(M, y, '4. Eligible ITC', 7.2, { weight: 700 });
  y += 8;
  y = d.table(
    M,
    y,
    [168, 46, 46, 46, 46],
    ['Details', 'Integrated tax', 'Central tax', 'State/UT tax', 'Cess'],
    [
      ['(A) ITC available', '•,•••', '•,•••', '•,•••', '0'],
      ['(B) ITC reversed', '0', '0', '0', '0'],
      ['(C) Net ITC available (A) – (B)', '•,•••', '•,•••', '•,•••', '0'],
    ],
    { bold: [2] },
  );
  y += 18;
  d.text(M, y, '6.1 Payment of tax', 7.2, { weight: 700 });
  d.bars(M, y + 10, IW, 3, 9, 3);
  signature(d, DOC_H - 50, 'Signature of authorised signatory');
  foot(d, 'GST PORTAL · ARN AA••••••••••••');
  return d.build('gstr3b', 'GSTR-3B return');
}

function invoice(): DocLayout {
  const d = new Doc(42);
  d.text(M, 44, 'TAX INVOICE', 17, { font: 'display', weight: 750, ls: 0.02 });
  d.mono(DOC_W - M, 32, 'ORIGINAL FOR RECIPIENT', 6.2, { anchor: 'end', fill: C.pencil, ls: 0.08 });
  d.mono(DOC_W - M, 46, 'No. GS/26-27/0142', 8, { anchor: 'end', weight: 650 });
  d.line(M, 58, DOC_W - M, 58, C.ink, 1.4);
  let y = 72;
  d.text(M, y, 'Sold by', 6.6, { fill: C.pencil });
  d.text(M, y + 12, '•••••• Enterprises', 8.6, { weight: 700 });
  d.bars(M, y + 20, 150, 2, 8, 2.6);
  d.mono(M, y + 44, 'GSTIN ••AAAAA0000A1Z•', 6.8, { weight: 600 });
  d.text(M + 196, y, 'Billed to', 6.6, { fill: C.pencil });
  d.text(M + 196, y + 12, '•••••• ••••••', 8.6, { weight: 700 });
  d.bars(M + 196, y + 20, 150, 2, 8, 2.6);
  d.mono(M + 196, y + 44, 'Date ••/08/2026', 6.8, { weight: 600 });
  y += 60;
  y = d.table(
    M,
    y,
    [24, 120, 52, 32, 56, 68],
    ['#', 'Description', 'HSN/SAC', 'Qty', 'Rate', 'Taxable value'],
    [
      ['1', '', '••••', '2', '•,•••.00', '•,•••.00'],
      ['2', '', '••••', '1', '••,•••.00', '••,•••.00'],
      ['3', '', '••••', '5', '•••.00', '•,•••.00'],
      ['4', '', '••••', '1', '•,•••.00', '•,•••.00'],
      ['5', '', '', '', '', ''],
      ['6', '', '', '', '', ''],
    ],
    { rowH: 19 },
  );
  y += 10;
  const lines: [string, string, boolean][] = [
    ['Taxable value', '₹ ••,•••.00', false],
    ['CGST @ 9%', '₹ •,•••.00', false],
    ['SGST @ 9%', '₹ •,•••.00', false],
    ['Round off', '₹ 0.••', false],
  ];
  lines.forEach(([k, v], i) => {
    d.text(DOC_W - M - 150, y + 10 + i * 14, k, 7.2, { fill: C.ink2 });
    d.mono(DOC_W - M - 4, y + 10 + i * 14, v, 7.2, { anchor: 'end', weight: 600 });
  });
  y += lines.length * 14 + 10;
  d.fill(DOC_W - M - 156, y, 156, 24, C.paperTint);
  d.text(DOC_W - M - 150, y + 16, 'Total', 9, { weight: 750 });
  d.mono(DOC_W - M - 4, y + 16, '₹ ••,•••.00', 9, { anchor: 'end', weight: 750 });
  d.text(M, y + 16, 'Amount in words: Rupees •••••• only', 6.6, { fill: C.pencil });
  y += 44;
  d.text(M, y, 'Bank details', 6.6, { fill: C.pencil });
  d.mono(M, y + 12, 'A/C XXXXXXXX1234 · IFSC XXXX0001234', 6.6, { weight: 600 });
  signature(d, DOC_H - 50, 'For •••••• Enterprises');
  foot(d, 'SUBJECT TO LOCAL JURISDICTION · E. & O.E.');
  return d.build('invoice', 'Tax invoice');
}

function challan280(): DocLayout {
  const d = new Doc(280);
  d.mono(M, 34, '* Important: Please see notes overleaf before filling up the challan', 5.8, { fill: C.pencil });
  d.rect(M, 42, IW, 44, { stroke: C.ink, sw: 1 });
  d.mono(M + 10, 60, 'CHALLAN NO./', 9, { weight: 700 });
  d.mono(M + 10, 76, 'ITNS 280', 13, { weight: 750 });
  d.text(M + 120, 58, 'Tax Applicable (Tick One)*', 7, { weight: 650 });
  d.text(M + 120, 72, 'INCOME-TAX ON (OTHER THAN COMPANIES)', 6.6, { fill: C.ink2 });
  d.rect(DOC_W - M - 64, 50, 54, 28, { stroke: C.ink2, sw: 0.6 });
  d.mono(DOC_W - M - 37, 62, 'Assessment', 5.6, { anchor: 'middle', fill: C.pencil });
  d.mono(DOC_W - M - 37, 72, 'Year', 5.6, { anchor: 'middle', fill: C.pencil });
  let y = 100;
  const opts = ['(0020) INCOME-TAX ON COMPANIES', '(0021) INCOME TAX (OTHER THAN COMPANIES)'];
  opts.forEach((o, i) => {
    d.rect(M + 4, y + i * 16 - 8, 9, 9, { stroke: C.ink2, sw: 0.7 });
    d.text(M + 20, y + i * 16, o, 7, { fill: C.ink2 });
  });
  d.line(M + 5, y + 16 - 4, M + 8, y + 16, C.carbon, 1.4);
  d.line(M + 8, y + 16, M + 13, y + 16 - 10, C.carbon, 1.4);
  d.text(M + 230, y, 'Assessment Year', 7, { weight: 650 });
  d.charBoxes(M + 230, y + 6, '2026-27', 13, 16);
  y += 40;
  d.text(M, y, 'Permanent Account Number', 7, { weight: 650 });
  d.charBoxes(M, y + 6, 'XXXXX1234X', 14, 17);
  y += 36;
  d.field(M, y, IW, 42, 'Full Name');
  y += 42;
  d.field(M, y, IW, 42, 'Complete Address with City & State');
  y += 56;
  d.text(M, y, 'Type of Payment (Tick One)', 7, { weight: 650 });
  ['(100) Advance Tax', '(300) Self Assessment Tax', '(400) Tax on Regular Assessment'].forEach((o, i) => {
    d.rect(M + 4 + i * 118, y + 8, 9, 9, { stroke: C.ink2, sw: 0.7 });
    d.text(M + 18 + i * 118, y + 16, o, 6.6, { fill: C.ink2 });
  });
  y += 30;
  y = d.table(
    M,
    y,
    [156, 110, 86],
    ['DETAILS OF PAYMENTS', 'Amount (in Rs. only)', 'FOR USE IN RECEIVING BANK'],
    [
      ['Income Tax', '••,•••', undefined],
      ['Surcharge', '0', undefined],
      ['Education Cess', '•,•••', undefined],
      ['Interest', '•••', undefined],
      ['Penalty', '0', undefined],
      ['Total', '••,•••', undefined],
    ],
    { bold: [5], rowH: 16 },
  );
  // bank seal in the right column
  const sx = DOC_W - M - 43;
  const sy = y - 52;
  d.prims.push({ t: 'circle', cx: sx, cy: sy, r: 30, stroke: C.carbon, sw: 1.4 });
  d.prims.push({ t: 'circle', cx: sx, cy: sy, r: 24, stroke: C.carbon, sw: 0.7, dash: [2, 2] });
  d.mono(sx, sy - 4, 'RECEIVED', 6.4, { anchor: 'middle', fill: C.carbon, weight: 700, rot: -14 });
  d.mono(sx, sy + 7, '••/••/26', 6, { anchor: 'middle', fill: C.carbon, rot: -14 });
  y += 14;
  d.text(M, y, 'Total (in words)', 6.6, { fill: C.pencil });
  d.bars(M + 70, y - 3, IW - 70, 1, 8, 2.6);
  y += 22;
  d.line(M, y, DOC_W - M, y, C.ink2, 0.6, [3, 3]);
  d.mono(DOC_W / 2, y + 14, 'Taxpayers Counterfoil', 7, { anchor: 'middle', weight: 700 });
  d.charBoxes(M, y + 24, 'XXXXX1234X', 12, 14);
  d.mono(DOC_W - M, y + 35, 'Rs. ••,•••', 7.6, { anchor: 'end', weight: 700 });
  foot(d, 'CIN · BSR ••••••• · CHALLAN ••••• · DATE ••/••/2026');
  return d.build('challan280', 'Challan ITNS 280');
}

function echallan(): DocLayout {
  const d = new Doc(99);
  d.fill(0, 0, DOC_W, 64, C.carbon);
  d.text(M, 30, 'e-Challan', 17, { font: 'display', weight: 750, fill: C.paper });
  d.mono(M, 48, 'ROAD TRANSPORT · PAYMENT RECEIPT', 6.6, { fill: C.carbonTint, ls: 0.1 });
  let y = 90;
  const kv: [string, string][] = [
    ['Challan No.', 'XX00000000000000'],
    ['Vehicle No.', 'XX 00 XX 0000'],
    ['Date of offence', '••/••/2026'],
    ['Offence', '••••• ••••••••'],
    ['Place', '•••••••••'],
    ['Payment mode', 'UPI'],
  ];
  kv.forEach(([k, v], i) => {
    d.text(M, y + i * 24, k, 7, { fill: C.pencil });
    d.mono(M + 120, y + i * 24, v, 8.4, { weight: 650 });
    d.line(M, y + i * 24 + 9, DOC_W - M, y + i * 24 + 9, C.paperLine, 0.6);
  });
  y += kv.length * 24 + 18;
  d.fill(M, y, IW, 58, C.carbonTint, 4);
  d.text(M + 14, y + 22, 'Amount paid', 7.4, { fill: C.carbon, weight: 600 });
  d.mono(M + 14, y + 44, '₹ •,•••.00', 17, { weight: 750, fill: C.carbon });
  d.rect(DOC_W - M - 90, y + 16, 76, 26, { stroke: C.forest, sw: 1.6, r: 3 });
  d.mono(DOC_W - M - 52, y + 33, 'PAID', 10, { anchor: 'middle', weight: 750, fill: C.forest, ls: 0.2 });
  y += 80;
  // QR-ish block
  const q = 86;
  const qx = M;
  d.rect(qx, y, q, q, { stroke: C.ink, sw: 1 });
  const cell = q / 14;
  for (let r = 0; r < 14; r++)
    for (let c = 0; c < 14; c++) {
      const finder = (r < 4 && c < 4) || (r < 4 && c > 9) || (r > 9 && c < 4);
      if (finder || d.rand() > 0.55) d.fill(qx + c * cell + 0.6, y + r * cell + 0.6, cell - 1.2, cell - 1.2, C.ink);
    }
  d.text(qx + q + 16, y + 14, 'Transaction reference', 6.6, { fill: C.pencil });
  d.mono(qx + q + 16, y + 28, 'TXN ••••••••••••', 8, { weight: 650 });
  d.text(qx + q + 16, y + 48, 'Assistance with payment on the official', 6.6, { fill: C.ink2 });
  d.text(qx + q + 16, y + 58, 'portal only. Fines are not waived.', 6.6, { fill: C.ink2 });
  foot(d, 'OFFICIAL PORTAL RECEIPT · KEEP FOR YOUR RECORDS');
  return d.build('echallan', 'Vehicle e-challan receipt');
}

function rent(): DocLayout {
  const d = new Doc(7);
  d.rect(14, 14, DOC_W - 28, DOC_H - 28, { stroke: C.forest, sw: 1.2, dash: [5, 3] });
  d.text(DOC_W / 2, 58, 'RENT RECEIPT', 18, { font: 'display', weight: 750, anchor: 'middle', ls: 0.06 });
  d.mono(DOC_W / 2, 76, 'Receipt No. 07 · Month: Aug 2026', 7, { anchor: 'middle', fill: C.pencil });
  let y = 116;
  const lines = [
    ['Received with thanks from', '•••••• ••••••'],
    ['the sum of Rupees', '••,••• only'],
    ['towards rent for the month of', 'August 2026'],
    ['for the premises at', '••••••••••••••••'],
  ];
  lines.forEach(([k, v], i) => {
    d.text(M + 8, y + i * 30, k, 8.2, { fill: C.ink2 });
    d.line(M + 8, y + i * 30 + 12, DOC_W - M - 8, y + i * 30 + 12, C.paperLine, 0.8, [1.5, 2.5]);
    d.text(DOC_W - M - 10, y + i * 30 + 9, v, 9, { anchor: 'end', weight: 650, fill: C.carbon });
  });
  y += lines.length * 30 + 16;
  d.rect(M + 8, y, 150, 34, { stroke: C.ink2, sw: 0.8 });
  d.mono(M + 16, y + 14, 'AMOUNT', 6, { fill: C.pencil, ls: 0.1 });
  d.mono(M + 16, y + 28, '₹ ••,•••/-', 11, { weight: 750 });
  y += 58;
  d.field(M + 8, y, 160, 30, 'Landlord PAN', 'XXXXX1234X');
  d.field(M + 8, y + 36, 160, 30, 'Landlord name', '•••••• ••••••', false);
  // revenue stamp
  const rx = DOC_W - M - 86;
  d.rect(rx, y - 4, 72, 72, { stroke: C.forest, sw: 1, dash: [2, 2] });
  d.fill(rx + 6, y + 2, 60, 60, C.mint);
  d.mono(rx + 36, y + 26, 'REVENUE', 7, { anchor: 'middle', weight: 700, fill: C.forestDeep, ls: 0.1 });
  d.mono(rx + 36, y + 42, '₹ 1', 12, { anchor: 'middle', weight: 750, fill: C.forestDeep });
  d.prims.push({ t: 'line', x1: rx - 10, y1: y + 60, x2: rx + 82, y2: y + 8, stroke: C.carbon, sw: 1.2 });
  signature(d, DOC_H - 64, 'Signature of landlord');
  return d.build('rent', 'Rent receipt');
}

function bank(): DocLayout {
  const d = new Doc(55);
  d.fill(0, 0, DOC_W, 6, C.forest);
  d.text(M, 38, '•••• BANK', 14, { font: 'display', weight: 750, fill: C.forest });
  d.mono(DOC_W - M, 32, 'STATEMENT OF ACCOUNT', 7.6, { anchor: 'end', weight: 700, ls: 0.1 });
  d.mono(DOC_W - M, 44, '01-Apr-2025 to 31-Mar-2026', 6.4, { anchor: 'end', fill: C.pencil });
  d.field(M, 56, IW / 2, 30, 'Account number', 'XXXXXXXX1234');
  d.field(M + IW / 2, 56, IW / 2, 30, 'IFSC', 'XXXX0001234');
  const rows: string[][] = [];
  const narr = ['UPI/•••••/•••', 'NEFT/•••••••', 'INT.PD', 'SALARY/••••', 'ATM/•••••', 'IMPS/•••••', 'UPI/•••••/•••', 'BIL/•••••••', 'INT.PD', 'UPI/•••••/•••', 'NEFT/•••••••', 'CHQ/••••••', 'UPI/•••••/•••', 'SALARY/••••'];
  narr.forEach((n, i) => {
    const credit = /SALARY|INT|NEFT/.test(n);
    rows.push([`${String(i * 2 + 1).padStart(2, '0')}/••`, n, credit ? '' : '•,•••.00', credit ? '••,•••.00' : '', '•,••,•••.00']);
  });
  const y = d.table(M, 100, [44, 118, 58, 64, 68], ['Date', 'Narration', 'Debit', 'Credit', 'Balance'], rows, { rowH: 21 });
  d.text(M, y + 18, 'Closing balance', 7.4, { weight: 700 });
  d.mono(DOC_W - M, y + 18, '₹ •,••,•••.00', 8.6, { anchor: 'end', weight: 750 });
  foot(d, 'THIS IS A COMPUTER GENERATED STATEMENT');
  return d.build('bank', 'Bank statement');
}

function form16a(): DocLayout {
  const d = new Doc(160);
  let y = header(d, 'FORM NO. 16A', '[See rule 31(1)(b)]');
  d.text(DOC_W / 2, y + 2, 'Certificate under section 203 of the Income-tax Act, 1961', 8, { anchor: 'middle', weight: 600 });
  d.text(DOC_W / 2, y + 13, 'for tax deducted at source', 8, { anchor: 'middle', weight: 600 });
  y += 24;
  d.field(M, y, IW / 2, 46, 'Name and address of the deductor');
  d.field(M + IW / 2, y, IW / 2, 46, 'Name and address of the deductee');
  y += 46;
  d.field(M, y, IW / 3, 30, 'TAN of the deductor', 'XXXX12345X');
  d.field(M + IW / 3, y, IW / 3, 30, 'PAN of the deductee', 'XXXXX5678X');
  d.field(M + (IW / 3) * 2, y, IW / 3, 30, 'Assessment Year', '2026-27');
  y += 46;
  d.text(M, y, 'Summary of payment', 7.4, { weight: 700 });
  y += 8;
  y = d.table(
    M,
    y,
    [28, 110, 70, 72, 72],
    ['Sl.', 'Amount paid / credited', 'Nature of payment', 'Deductee ref.', 'Date of payment'],
    [
      ['1', '₹ ••,•••', '194J', '••••', '••-••-2025'],
      ['2', '₹ ••,•••', '194J', '••••', '••-••-2025'],
      ['3', '₹ ••,•••', '194J', '••••', '••-••-2026'],
    ],
  );
  y += 18;
  d.text(M, y, 'Summary of tax deducted at source in respect of deductee', 7.4, { weight: 700 });
  y += 8;
  d.table(
    M,
    y,
    [96, 128, 128],
    ['Quarter', 'Receipt numbers of original quarterly statements', 'Amount of tax deducted'],
    [
      ['Q1', 'QVX••••••', '₹ •,•••'],
      ['Q2', 'QVX••••••', '₹ •,•••'],
      ['Q3', 'QVX••••••', '₹ •,•••'],
      ['Total', '', '₹ •,•••'],
    ],
    { bold: [3], headH: 24 },
  );
  signature(d, DOC_H - 50, 'Signature of person responsible for deduction of tax');
  foot(d, 'TRACES · CERTIFICATE NO. ••••••');
  return d.build('form16a', 'Form 16A');
}

/** The slip the top sheet turns into. ITR-V-like, but clearly generic. */
function acknowledgement(): DocLayout {
  const d = new Doc(1);
  d.fill(0, 0, DOC_W, 8, C.forest);
  d.mono(DOC_W / 2, 44, 'ACKNOWLEDGEMENT', 16, { anchor: 'middle', weight: 750, ls: 0.1, fill: C.forest });
  d.text(DOC_W / 2, 62, 'Income tax return filed electronically', 8.4, { anchor: 'middle', fill: C.ink2 });
  d.mono(DOC_W / 2, 76, 'ASSESSMENT YEAR 2026-27', 7, { anchor: 'middle', fill: C.pencil, ls: 0.12 });
  let y = 100;
  d.rect(M, y, IW, 50, { stroke: C.carbon, sw: 1.2, r: 3 });
  d.text(M + 12, y + 17, 'Acknowledgement No.', 7, { fill: C.carbon, weight: 600 });
  d.mono(M + 12, y + 38, '•••• •••• •••• •••', 15, { weight: 750, fill: C.carbon, ls: 0.04 });
  y += 68;
  const kv: [string, string][] = [
    ['PAN', 'XXXXX1234X'],
    ['Name', '••••• •••••'],
    ['Form', 'ITR-•'],
    ['Date of filing', '••-••-2026'],
    ['Total income', '₹ ••,••,•••'],
    ['Tax payable', '₹ ••,•••'],
    ['Taxes paid', '₹ ••,•••'],
    ['Refund / (Tax due)', '₹ 0'],
  ];
  kv.forEach(([k, v], i) => {
    d.text(M, y + i * 20, k, 7.6, { fill: C.ink2 });
    d.line(M + 96, y + i * 20 + 1, DOC_W - M - 100, y + i * 20 + 1, C.paperLine, 0.8, [1.5, 2.5]);
    d.mono(DOC_W - M, y + i * 20, v, 8.4, { anchor: 'end', weight: 650 });
  });
  y += kv.length * 20 + 10;
  d.fill(M, y, IW, 34, C.mint, 4);
  d.text(M + 14, y + 21, 'e-Verified. Nothing more to do.', 9.4, { weight: 700, fill: C.forestDeep });
  d.mono(DOC_W - M - 14, y + 21, '✓', 13, { anchor: 'end', weight: 750, fill: C.forest });
  y += 52;
  d.text(M, y, 'Prepared, reviewed with you, and filed on the official portal.', 7.2, { fill: C.pencil });
  foot(d, 'GROWTHSENSE · FILING SLIP · KEEP FOR YOUR RECORDS');
  return d.build('ack', 'Acknowledgement slip');
}

const builders: Record<DocKind, () => DocLayout> = {
  form16,
  ais,
  gstr3b,
  invoice,
  challan280,
  echallan,
  rent,
  bank,
  form16a,
};

const cache = new Map<string, DocLayout>();
export function docLayout(kind: DocKind | 'ack'): DocLayout {
  let l = cache.get(kind);
  if (!l) {
    l = kind === 'ack' ? acknowledgement() : builders[kind]();
    cache.set(kind, l);
  }
  return l;
}

/* ─── the FILED impression ─────────────────────────────────────────────────────────────────────────── */

/** Logical size of the stamp impression artwork (matches HERO.impression aspect 0.46 : 0.2). */
export const IMPRESSION_W = 230;
export const IMPRESSION_H = 100;

export function impressionLayout(): Prim[] {
  const W = IMPRESSION_W;
  const H = IMPRESSION_H;
  return [
    { t: 'rect', x: 5, y: 5, w: W - 10, h: H - 10, stroke: C.stamp, sw: 5, r: 8 },
    { t: 'rect', x: 13, y: 13, w: W - 26, h: H - 26, stroke: C.stamp, sw: 2, r: 5 },
    { t: 'text', x: W / 2 - 19, y: H / 2 + 16, s: 'FILED', size: 44, font: 'mono', weight: 800, fill: C.stamp, anchor: 'middle', ls: 0.06 },
    { t: 'text', x: W - 34, y: H / 2 + 15, s: '✓', size: 40, font: 'text', weight: 800, fill: C.stamp, anchor: 'middle' },
  ];
}
