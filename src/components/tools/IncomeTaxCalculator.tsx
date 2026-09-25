import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowRight, Calculator, CircleCheck as Check2, ChevronDown, Minus, Phone, Plus, RotateCcw } from 'lucide-react';
import FiledCta from '@/components/tools/FiledCta';
import { Check, MoneyField, Notice, PartLegend, Segmented, ShareOptIn } from '@/components/tools/sc-fields';
import { prefersReducedMotion, Receipt, RcLine, RcLines, RcTotal, Stamp, useSettled, vars } from '@/components/tools/receipt';
import { telUrl } from '@/lib/contact';
import { site } from '@/config/site';
import { formatINR, parseAmount } from '@/lib/format';
import { compareRegimes } from '@/lib/tax/compute';
import { defaultYearId, getRules, taxYears } from '@/lib/tax/rules';
import type { AgeBracket, BreakdownLine, Regime, RegimeComparison, TaxBreakdown, TaxInput, TaxRules, YearId } from '@/lib/tax/types';
import '@/components/tools/tools.css';
import './IncomeTaxCalculator.css';

type AmountKey =
  | 'salary'
  | 'savingsInterest'
  | 'depositInterest'
  | 'dividends'
  | 'rentalIncome'
  | 'familyPension'
  | 'otherIncome'
  | 'stcg111A'
  | 'ltcg112A'
  | 'hraExemption'
  | 'homeLoanInterest'
  | 'c80'
  | 'ccd1b'
  | 'd80Self'
  | 'd80Parents'
  | 'employerNps'
  | 'basicPlusDA';

const AGES: { value: AgeBracket; label: string; long: string }[] = [
  { value: 'below60', label: 'Below 60', long: 'below 60' },
  { value: '60to79', label: '60 to 79', long: '60 to 79' },
  { value: '80plus', label: '80 and above', long: '80 and above' },
];

const pct = (r: number) => `${+(r * 100).toFixed(2)}%`;

const REGIME_NAME: Record<Regime, string> = { new: 'New regime', old: 'Old regime' };

const incomeKeys: AmountKey[] = [
  'salary', 'savingsInterest', 'depositInterest', 'dividends', 'rentalIncome', 'familyPension', 'otherIncome', 'stcg111A', 'ltcg112A',
];

function fmtLine(l: BreakdownLine): string {
  if (l.kind === 'less') return `− ${formatINR(l.amount)}`;
  return formatINR(l.amount);
}

/** Splits the engine's flat line list into heads (Income, Deductions, Tax). Totals print outside the fold. */
interface Head {
  head: BreakdownLine | null;
  body: BreakdownLine[];
  totals: BreakdownLine[];
}
function groupHeads(lines: BreakdownLine[]): Head[] {
  const out: Head[] = [];
  let cur: Head | null = null;
  for (const l of lines) {
    if (l.kind === 'heading') {
      cur = { head: l, body: [], totals: [] };
      out.push(cur);
      continue;
    }
    if (!cur) {
      cur = { head: null, body: [], totals: [] };
      out.push(cur);
    }
    (l.kind === 'total' ? cur.totals : cur.body).push(l);
  }
  return out;
}

const tone = (k: BreakdownLine['kind']) => (k === 'less' ? 'less' : k === 'subtotal' ? 'sub' : k === 'total' ? 'strong' : 'item');

/** The full engine breakdown for one regime, as a long receipt with a fold per head. */
function ItemisedSlip({
  rg,
  b,
  rules,
  isOpen,
  toggle,
}: {
  rg: Regime;
  b: TaxBreakdown;
  rules: TaxRules;
  isOpen: (key: string) => boolean;
  toggle: (key: string) => void;
}) {
  const uid = useId();
  const heads = groupHeads(b.lines);
  const last = b.lines[b.lines.length - 1];
  return (
    <Receipt
      className="itc-long"
      heading={<h3 className="rc__title">{REGIME_NAME[rg]}, itemised</h3>}
      meta={rules.label}
    >
      {heads.map((h, i) => {
        const key = `${rg}:${h.head?.key ?? i}`;
        const open = isOpen(key);
        const tail = h.body[h.body.length - 1];
        const summary = tail && tail.kind === 'subtotal' ? formatINR(tail.amount) : `${h.body.length} lines`;
        const panelId = `${uid}-${i}`;
        return (
          <div key={key} className={`itc-sec${open ? ' is-open' : ''}`}>
            {h.head && h.body.length > 0 && (
              <>
                <button
                  type="button"
                  className="itc-sec__btn"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggle(key)}
                >
                  <span className="itc-sec__label">{h.head.label}</span>
                  <span className="itc-sec__amt">{summary}</span>
                  <span className="itc-sec__icon" aria-hidden="true">
                    <ChevronDown />
                  </span>
                </button>
                <div className="ws-drawer__panel" id={panelId} inert={!open}>
                  <div className="ws-drawer__inner">
                    <RcLines className="itc-sec__lines">
                      {h.body.map((l) => (
                        <RcLine key={l.key} label={l.label} value={fmtLine(l)} tone={tone(l.kind)} note={l.note} />
                      ))}
                    </RcLines>
                  </div>
                </div>
              </>
            )}
            {h.totals
              .filter((t) => t !== last)
              .map((t) => (
                <RcLines key={t.key} className="itc-sec__total">
                  <RcLine label={t.label} value={fmtLine(t)} tone="strong" note={t.note} />
                </RcLines>
              ))}
          </div>
        );
      })}
      {last && last.kind === 'total' && <RcTotal label={last.label} figure={formatINR(last.amount)} />}
    </Receipt>
  );
}

/* ---------- comparison helpers ---------- */

type Better = 'low' | 'high' | null;
interface CompareRow {
  key: string;
  label: ReactNode;
  old: number;
  new: number;
  /** Which direction is better for the taxpayer. null: informational, no highlight. */
  better: Better;
  fmt?: (n: number) => string;
  total?: boolean;
  less?: boolean;
}

const lessINR = (n: number) => (n > 0 ? `− ${formatINR(n)}` : formatINR(0));
const rate1 = (n: number) => `${(n * 100).toFixed(1)}%`;

function winner(r: CompareRow): Regime | null {
  if (!r.better || Math.round(r.old) === Math.round(r.new)) return null;
  const oldWins = r.better === 'low' ? r.old < r.new : r.old > r.new;
  return oldWins ? 'old' : 'new';
}

/** Two horizontal bars scaled to the larger tax. The figure carries a text alternative. */
function TaxBars({ cmp }: { cmp: RegimeComparison }) {
  const max = Math.max(cmp.old.totalTax, cmp.new.totalTax, 1);
  const rows: Regime[] = ['old', 'new'];
  const label = `Tax comparison: old regime ${formatINR(cmp.old.totalTax)}, new regime ${formatINR(cmp.new.totalTax)}.`;
  return (
    <figure className="itc-bars" role="img" aria-label={label}>
      {rows.map((rg) => {
        const tax = cmp[rg].totalTax;
        const best = cmp.better === rg;
        return (
          <div key={rg} className={`itc-bar${best ? ' is-better' : ''}`} aria-hidden="true">
            <span className="itc-bar__name">{REGIME_NAME[rg]}</span>
            <span className="itc-bar__track">
              <span className="itc-bar__fill" style={vars({ '--s': tax / max })} />
            </span>
            <span className="itc-bar__amt">{formatINR(tax)}</span>
          </div>
        );
      })}
    </figure>
  );
}

const incomeMore: AmountKey[] = ['dividends', 'familyPension', 'stcg111A', 'ltcg112A'];
const dedMore: AmountKey[] = ['ccd1b', 'employerNps', 'basicPlusDA'];

const EMPTY: Record<AmountKey, string> = {
  salary: '',
  savingsInterest: '',
  depositInterest: '',
  dividends: '',
  rentalIncome: '',
  familyPension: '',
  otherIncome: '',
  stcg111A: '',
  ltcg112A: '',
  hraExemption: '',
  homeLoanInterest: '',
  c80: '',
  ccd1b: '',
  d80Self: '',
  d80Parents: '',
  employerNps: '',
  basicPlusDA: '',
};

/** Inline "show more fields" toggle. The fields stay in the normal tab order once shown. */
function MoreToggle({
  open,
  onToggle,
  controls,
  children,
  count,
}: {
  open: boolean;
  onToggle: () => void;
  controls: string;
  children: ReactNode;
  count: number;
}) {
  return (
    <button type="button" className="itc-more" aria-expanded={open} aria-controls={controls} onClick={onToggle}>
      {open ? <Minus aria-hidden="true" /> : <Plus aria-hidden="true" />}
      <span>{children}</span>
      {count > 0 && <span className="itc-more__count">{count} filled</span>}
    </button>
  );
}

export default function IncomeTaxCalculator() {
  const uid = useId();
  const [yearId, setYearId] = useState<YearId>(defaultYearId);
  const [age, setAge] = useState<AgeBracket>('below60');
  const [parentsSenior, setParentsSenior] = useState(false);
  const [optIn, setOptIn] = useState(false);
  const [openHeads, setOpenHeads] = useState<Record<string, boolean>>({});
  const [showItems, setShowItems] = useState(false);
  const [moreIncome, setMoreIncome] = useState(false);
  const [moreDed, setMoreDed] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const [error, setError] = useState('');
  const [focusTick, setFocusTick] = useState(0);
  const [updated, setUpdated] = useState(false);
  const [pill, setPill] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [v, setV] = useState<Record<AmountKey, string>>(EMPTY);

  const rules = getRules(yearId);
  const L = rules.sectionLabels;
  const senior = age !== 'below60';
  const id = (k: AmountKey) => `${uid}-${k}`;

  const field = (key: AmountKey, label: ReactNode, hint?: ReactNode) => (
    <MoneyField
      id={id(key)}
      decimals={false}
      label={label}
      hint={hint}
      value={v[key]}
      onChange={(val) => {
        setV((s) => ({ ...s, [key]: val }));
        if (error) setError('');
      }}
    />
  );

  const input: TaxInput = useMemo(() => {
    const n = (k: AmountKey) => parseAmount(v[k]);
    return {
      age,
      salary: n('salary'),
      savingsInterest: n('savingsInterest'),
      depositInterest: n('depositInterest'),
      dividends: n('dividends'),
      rentalIncome: n('rentalIncome'),
      familyPension: n('familyPension'),
      otherIncome: n('otherIncome'),
      stcg111A: n('stcg111A'),
      ltcg112A: n('ltcg112A'),
      hraExemption: n('hraExemption'),
      homeLoanInterest: n('homeLoanInterest'),
      c80: n('c80'),
      ccd1b: n('ccd1b'),
      d80Self: n('d80Self'),
      d80Parents: n('d80Parents'),
      parentsSenior,
      employerNps: n('employerNps'),
      basicPlusDA: n('basicPlusDA') || undefined,
    };
  }, [v, age, parentsSenior]);

  const cmp = useMemo(() => compareRegimes(input, rules), [input, rules]);
  const incomeEntered = incomeKeys.reduce((sum, k) => sum + parseAmount(v[k]), 0);
  const hasIncome = incomeEntered > 0;
  const showResult = calculated && hasIncome;
  const regimes: Regime[] = ['old', 'new'];
  const ageLong = AGES.find((a) => a.value === age)?.long ?? '';
  const filled = (keys: AmountKey[]) => keys.filter((k) => parseAmount(v[k]) > 0).length;
  const moreIncomeOpen = moreIncome || filled(incomeMore) > 0;
  const moreDedOpen = moreDed || filled(dedMore) > 0;

  // Figures settle once typing pauses, so the verdict, stamp and "updated" cue land once per change.
  const settled = useSettled(cmp, 450);
  const settledKey = `${settled.new.totalTax}|${settled.old.totalTax}|${settled.new.yearId}`;
  const stampKey = `${settled.better}|${settled.saving}|${settled.new.yearId}`;

  // "Updated" cue: only for changes after the first calculation.
  const shownKey = useRef<string | null>(null);
  useEffect(() => {
    if (!showResult) {
      shownKey.current = null;
      return;
    }
    if (shownKey.current === null) {
      shownKey.current = settledKey;
      return;
    }
    if (shownKey.current === settledKey) return;
    shownKey.current = settledKey;
    setUpdated(true);
    const t = setTimeout(() => setUpdated(false), 1800);
    return () => clearTimeout(t);
  }, [settledKey, showResult]);

  // Move to the result after "Calculate my tax".
  useEffect(() => {
    if (!focusTick) return;
    const h = headingRef.current;
    if (!h) return;
    h.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    h.focus({ preventScroll: true });
  }, [focusTick]);

  // Mobile: a compact result pill while the result is out of view.
  useEffect(() => {
    const el = resultRef.current;
    if (!el || !showResult || typeof IntersectionObserver === 'undefined') {
      setPill(false);
      return;
    }
    const io = new IntersectionObserver(([e]) => setPill(!e.isIntersecting), { rootMargin: '0px 0px -20% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [showResult]);

  const calculate = () => {
    if (!hasIncome) {
      setError('Enter your salary or at least one other income to calculate.');
      document.getElementById(id('salary'))?.focus();
      return;
    }
    setError('');
    setCalculated(true);
    setFocusTick((t) => t + 1);
  };

  const reset = () => {
    setV(EMPTY);
    setAge('below60');
    setYearId(defaultYearId);
    setParentsSenior(false);
    setOptIn(false);
    setMoreIncome(false);
    setMoreDed(false);
    setShowItems(false);
    setOpenHeads({});
    setCalculated(false);
    setError('');
    document.getElementById(id('salary'))?.focus();
  };

  const verdict =
    settled.better === 'equal'
      ? `Both regimes come to ${formatINR(settled.new.totalTax)}.`
      : `The ${settled.better} regime saves you ${formatINR(settled.saving)}.`;

  const summary = [
    `My estimate (${rules.label}, age ${ageLong}):`,
    `Income entered: ${formatINR(incomeEntered)}`,
    `New regime tax: ${formatINR(cmp.new.totalTax)}`,
    `Old regime tax: ${formatINR(cmp.old.totalTax)}`,
  ].join('\n');

  const notes = [...new Set([...cmp.new.notes, ...cmp.old.notes])];

  const otherDed = (b: TaxBreakdown) =>
    b.income.hraExemption + b.income.houseStandardDeduction + b.income.selfOccupiedInterest + b.income.familyPensionDeduction + b.totalDeductions;
  const takeHome = (b: TaxBreakdown) => Math.max(0, incomeEntered - b.totalTax) / 12;
  const hasSpecial = cmp.old.specialTax > 0 || cmp.new.specialTax > 0;
  const rows: CompareRow[] = [
    { key: 'gross', label: 'Income you entered', old: incomeEntered, new: incomeEntered, better: null },
    { key: 'std', label: `Standard deduction`, old: cmp.old.income.standardDeduction, new: cmp.new.income.standardDeduction, better: 'high', fmt: lessINR, less: true },
    { key: 'ded', label: 'Other deductions and exemptions', old: otherDed(cmp.old), new: otherDed(cmp.new), better: 'high', fmt: lessINR, less: true },
    { key: 'taxable', label: 'Taxable income', old: cmp.old.totalIncome, new: cmp.new.totalIncome, better: 'low' },
    { key: 'slab', label: 'Tax on slabs', old: cmp.old.slabTax, new: cmp.new.slabTax, better: 'low' },
    ...(hasSpecial
      ? [{ key: 'special', label: 'Tax on capital gains', old: cmp.old.specialTax, new: cmp.new.specialTax, better: 'low' as const }]
      : []),
    {
      key: 'rebate',
      label: `Rebate (${L.rebate})`,
      old: cmp.old.rebate + cmp.old.rebateMarginalRelief,
      new: cmp.new.rebate + cmp.new.rebateMarginalRelief,
      better: 'high',
      fmt: lessINR,
      less: true,
    },
    { key: 'surcharge', label: 'Surcharge', old: cmp.old.surcharge.net, new: cmp.new.surcharge.net, better: 'low' },
    { key: 'cess', label: `Cess at ${pct(rules.cessRate)}`, old: cmp.old.cess, new: cmp.new.cess, better: 'low' },
    { key: 'total', label: 'Total tax', old: cmp.old.totalTax, new: cmp.new.totalTax, better: 'low', total: true },
    { key: 'eff', label: 'Effective rate', old: cmp.old.effectiveRate, new: cmp.new.effectiveRate, better: 'low', fmt: rate1 },
    { key: 'home', label: 'Monthly take-home, estimate', old: takeHome(cmp.old), new: takeHome(cmp.new), better: 'high', fmt: (n) => formatINR(Math.round(n)) },
  ];

  // Section folds of the itemised receipts.
  const headKeys = regimes.flatMap((rg) =>
    groupHeads(cmp[rg].lines)
      .map((h, i) => (h.head && h.body.length ? `${rg}:${h.head.key ?? i}` : null))
      .filter((k): k is string => k !== null),
  );
  const allOpen = headKeys.length > 0 && headKeys.every((k) => openHeads[k]);
  const toggleHead = (k: string) => setOpenHeads((s) => ({ ...s, [k]: !s[k] }));
  const setAll = (open: boolean) => setOpenHeads(Object.fromEntries(headKeys.map((k) => [k, open])));

  const tel = telUrl();
  const resultId = `${uid}-result`;
  const itemsId = `${uid}-items`;
  const cap = (n: number) => `max ${formatINR(n)}`;
  const oldOnly = 'Only affects the old regime';

  return (
    <div className="itc">
      <div className="ws-calc ws-calc--wide">
        <form
          className="ws-sheet itc-sheet"
          aria-label="Income tax inputs"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            calculate();
          }}
        >
          <div className="ws-sheet__head">
            <span className="ws-sheet__tag">Worksheet · Annual figures</span>
            <p className="ws-sheet__hint">Three steps. Leave blank anything that does not apply.</p>
          </div>

          <fieldset className="ws-part itc-step">
            <PartLegend part="1">About you</PartLegend>
            <p className="ws-part__intro">The year decides which slabs apply. Age changes the old-regime exemption limit.</p>
            <div className="itc-choices">
              <Segmented
                legend="Year"
                name={`${uid}-year`}
                options={taxYears.map((y) => ({ value: y.id, label: y.shortLabel, sub: `${y.act} Act` }))}
                value={yearId}
                onChange={setYearId}
              />
              <Segmented legend="Your age" name={`${uid}-age`} options={AGES} value={age} onChange={setAge} />
              <p className="ws-note itc-year-label">
                {rules.label}, under the Income-tax Act, {rules.act}.
              </p>
            </div>
          </fieldset>

          <fieldset className="ws-part itc-step">
            <PartLegend part="2">Your income</PartLegend>
            <p className="ws-part__intro">Yearly amounts, before tax. Salary is enough for most people.</p>
            <div className="itc-salary">
              {field('salary', 'Gross salary for the year', 'From Form 16 or your payslips: total pay before HRA exemption and standard deduction.')}
            </div>
            <div className="ws-grid">
              {field('savingsInterest', 'Savings account interest')}
              {field('depositInterest', 'FD and other interest')}
              {field('rentalIncome', 'Rent from a let-out property', 'Rent received less municipal tax. 30% is deducted for you.')}
              {field('otherIncome', 'Any other income')}
            </div>
            <MoreToggle
              open={moreIncomeOpen}
              onToggle={() => setMoreIncome(!moreIncomeOpen)}
              controls={`${uid}-more-income`}
              count={filled(incomeMore)}
            >
              More income types: dividends, family pension, capital gains
            </MoreToggle>
            <div id={`${uid}-more-income`} className="ws-grid itc-more-panel" hidden={!moreIncomeOpen}>
              {field('dividends', 'Dividends')}
              {field('familyPension', 'Family pension')}
              {field('stcg111A', `Short-term gains on listed shares (${L.stcg})`, `Taxed at ${pct(rules.special.stcg111ARate)}.`)}
              {field(
                'ltcg112A',
                `Long-term gains on listed shares (${L.ltcg})`,
                `${pct(rules.special.ltcg112ARate)} above ${formatINR(rules.special.ltcg112AExemption)}.`,
              )}
            </div>
          </fieldset>

          <fieldset className="ws-part itc-step">
            <PartLegend part="3">Deductions (old regime only)</PartLegend>
            <p className="ws-part__intro">
              The new regime ignores these. Fill them to see if the old regime works out cheaper. Limits are applied for you.
            </p>
            <div className="ws-grid">
              {field(
                'hraExemption',
                'HRA exemption',
                <>
                  {L.hra} · {oldOnly}. Work it out with the <a href="/tools/hra-calculator">HRA calculator</a>.
                </>,
              )}
              {field('c80', 'PPF, ELSS, EPF, life insurance', `${L.c80} · ${cap(rules.caps.c80)} · ${oldOnly}.`)}
              {field(
                'd80Self',
                'Health insurance: self and family',
                `${L.d80} · ${cap(senior ? rules.caps.d80SelfSenior : rules.caps.d80SelfBelow60)} at your age · ${oldOnly}.`,
              )}
              {field(
                'd80Parents',
                'Health insurance: parents',
                `${L.d80} · ${cap(parentsSenior ? rules.caps.d80ParentsSenior : rules.caps.d80ParentsBelow60)} · ${oldOnly}.`,
              )}
              {field(
                'homeLoanInterest',
                'Home-loan interest, self-occupied house',
                `${L.selfOccupiedInterest} · ${cap(rules.caps.selfOccupiedInterest)} · ${oldOnly}.`,
              )}
              <div className="itc-check">
                <Check checked={parentsSenior} onChange={setParentsSenior}>
                  My parents are 60 or older
                </Check>
              </div>
            </div>
            <MoreToggle
              open={moreDedOpen}
              onToggle={() => setMoreDed(!moreDedOpen)}
              controls={`${uid}-more-ded`}
              count={filled(dedMore)}
            >
              More deductions: own NPS, employer NPS
            </MoreToggle>
            <div id={`${uid}-more-ded`} className="itc-more-panel" hidden={!moreDedOpen}>
              <div className="ws-grid">
                {field('ccd1b', 'Own NPS contribution', `${L.ccd1b} · ${cap(rules.caps.ccd1b)} · ${oldOnly}.`)}
                {field(
                  'employerNps',
                  'Employer NPS contribution',
                  `${L.ccd2} · Counts in both regimes: up to ${pct(rules.regimes.new.employerNpsPct)} (new) or ${pct(rules.regimes.old.employerNpsPct)} (old) of basic + DA.`,
                )}
                {field('basicPlusDA', 'Basic + DA', 'Used only for the employer NPS limit. Leave blank to use gross salary.')}
              </div>
            </div>
            <p className="ws-note itc-interest-note">
              Savings interest deduction ({senior ? L.ttb : L.tta}) is applied automatically in the old regime, up to{' '}
              {formatINR(senior ? rules.caps.ttb : rules.caps.tta)}.
            </p>
          </fieldset>

          <div className={`itc-actions${showResult ? '' : ' is-sticky'}`}>
            {error && (
              <p className="itc-error" role="alert">
                {error}
              </p>
            )}
            <div className="itc-actions__row">
              <button type="submit" className="btn btn--primary btn--lg itc-calc">
                <Calculator aria-hidden="true" /> {showResult ? 'Recalculate' : 'Calculate my tax'}
              </button>
              <button type="button" className="btn btn--ghost itc-reset" onClick={reset}>
                <RotateCcw aria-hidden="true" /> Reset
              </button>
            </div>
          </div>
        </form>

        <section className="ws-result itc-result" ref={resultRef} id={resultId} aria-labelledby={`${uid}-result-h`}>
          <h2 className="itc-result__title" id={`${uid}-result-h`} ref={headingRef} tabIndex={-1}>
            Your estimate
          </h2>
          {rules.verified.status !== 'verified' && (
            <Notice tone="warn" className="itc-verify">
              <strong>Not yet verified.</strong> {rules.verified.note}
            </Notice>
          )}

          {showResult ? (
            <>
              <div className="itc-verdict">
                <p className="itc-verdict__meta">
                  <span>
                    Verdict · {rules.shortLabel} · Age {ageLong}
                  </span>
                  <span className={`itc-updated${updated ? ' is-shown' : ''}`} aria-hidden="true">
                    Updated
                  </span>
                </p>
                <p className="itc-verdict__text" aria-live="polite" aria-atomic="true">
                  {verdict}
                </p>
                {settled.better !== 'equal' && (
                  <Stamp key={stampKey} top="Better" main={`${settled.better === 'new' ? 'New' : 'Old'} regime`} />
                )}
              </div>

              <TaxBars cmp={settled} />

              <div className="itc-table-wrap">
                <table className="itc-table">
                  <caption className="ws-sr">Old and new regime, side by side</caption>
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="ws-sr">Item</span>
                      </th>
                      <th scope="col" className={settled.better === 'old' ? 'is-best' : undefined}>
                        Old regime
                      </th>
                      <th scope="col" className={settled.better === 'new' ? 'is-best' : undefined}>
                        New regime
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const w = winner(r);
                      const f = r.fmt ?? formatINR;
                      return (
                        <tr key={r.key} className={r.total ? 'itc-table__total' : r.less ? 'is-less' : undefined}>
                          <th scope="row">{r.label}</th>
                          {regimes.map((rg) => (
                            <td key={rg} className={w === rg ? 'is-better' : undefined}>
                              {f(r[rg])}
                              {w === rg && <span className="ws-sr"> (better)</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ul className="ws-fine itc-notes">
                <li>Take-home is the income you entered less tax, divided by 12. PF, professional tax and other payroll deductions are not included.</li>
                {notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>

              <button
                type="button"
                className="itc-items-toggle"
                aria-expanded={showItems}
                aria-controls={itemsId}
                onClick={() => setShowItems(!showItems)}
              >
                <span>{showItems ? 'Hide the itemised receipts' : 'See every line: itemised receipts for both regimes'}</span>
                <ChevronDown aria-hidden="true" />
              </button>
            </>
          ) : (
            <div className="itc-waiting">
              <Receipt className="itc-blank" heading={<h3 className="rc__title">Your two receipts print here</h3>} meta={rules.label}>
                <p className="rc-caption itc-empty">Fill in step 2, then press Calculate my tax.</p>
                <div className="itc-blank__lines" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </Receipt>
              <ul className="itc-promise">
                <li>
                  <Check2 aria-hidden="true" /> A clear verdict: which regime costs you less, and by how much
                </li>
                <li>
                  <Check2 aria-hidden="true" /> Old and new side by side, line by line
                </li>
                <li>
                  <Check2 aria-hidden="true" /> Your monthly take-home under each
                </li>
              </ul>
            </div>
          )}
        </section>
      </div>

      {showResult && (
        <section id={itemsId} className="itc-items" aria-labelledby={`${uid}-items-h`} hidden={!showItems}>
          <div className="itc-items__head">
            <div>
              <h2 id={`${uid}-items-h`} className="itc-items__title">
                Itemised receipts
              </h2>
              <p className="ws-note">Every step of the calculation, head by head. Open a head to see its lines.</p>
            </div>
            <button type="button" className="itc-all" onClick={() => setAll(!allOpen)}>
              {allOpen ? 'Fold all heads' : 'Show every line'}
            </button>
          </div>
          <div className="itc-items__grid">
            {regimes.map((rg) => (
              <ItemisedSlip key={rg} rg={rg} b={cmp[rg]} rules={rules} isOpen={(k) => !!openHeads[k]} toggle={toggleHead} />
            ))}
          </div>
        </section>
      )}

      {showResult && (
        <section className="itc-next" aria-labelledby={`${uid}-next-h`}>
          <div className="itc-next__copy">
            <h2 id={`${uid}-next-h`} className="itc-next__title">
              Want this filed? Send it on WhatsApp.
            </h2>
            <p className="itc-next__text">
              {site.owner.name} checks the figures, tells you which regime to pick and files your return. You get a quote
              before any work starts.
            </p>
            <ShareOptIn checked={optIn} onChange={setOptIn} label="Include my figures in the WhatsApp message" />
          </div>
          <div className="itc-next__actions">
            <FiledCta tool="income tax calculator" details={optIn ? summary : undefined} />
            <a className="btn btn--ghost" href={tel ?? '/contact'}>
              <Phone aria-hidden="true" /> Call
            </a>
            <a className="link-arrow itc-next__link" href="/services/income-tax-return-filing">
              See the ITR filing checklist <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </section>
      )}

      {showResult && (
        <a className={`itc-pill${pill ? ' is-shown' : ''}`} href={`#${resultId}`} inert={!pill}>
          <span className="itc-pill__item">
            {settled.better === 'equal' ? (
              <>
                <span className="itc-pill__k">Both</span> {formatINR(settled.new.totalTax)}
              </>
            ) : (
              <>
                <span className="itc-pill__k">{settled.better === 'new' ? 'New' : 'Old'} regime:</span>{' '}
                {formatINR(settled[settled.better].totalTax)}
              </>
            )}
          </span>
          <span className="itc-pill__see">See results</span>
          <span className="itc-pill__go" aria-hidden="true">
            <ArrowDown />
          </span>
        </a>
      )}
    </div>
  );
}
