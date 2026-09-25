import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Calculator, CircleCheck as Check2, ChevronDown, Minus, Phone, Plus, RotateCcw } from 'lucide-react';
import FiledCta from '@/components/tools/FiledCta';
import { TabList, tabId, tabPanelProps, type TabItem } from '@/components/tools/Tabs';
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

type InTab = 'you' | 'income' | 'ded';
type OutTab = 'compare' | 'old' | 'new';
const IN_ORDER: InTab[] = ['you', 'income', 'ded'];
const IN_NAME: Record<InTab, string> = { you: 'About you', income: 'Income', ded: 'Deductions' };

export default function IncomeTaxCalculator() {
  const uid = useId();
  const [yearId, setYearId] = useState<YearId>(defaultYearId);
  const [age, setAge] = useState<AgeBracket>('below60');
  const [parentsSenior, setParentsSenior] = useState(false);
  const [optIn, setOptIn] = useState(false);
  const [openHeads, setOpenHeads] = useState<Record<string, boolean>>({});
  const [moreIncome, setMoreIncome] = useState(false);
  const [moreDed, setMoreDed] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const [error, setError] = useState('');
  const [focusTick, setFocusTick] = useState(0);
  const [updated, setUpdated] = useState(false);
  const [pill, setPill] = useState(false);
  const [inTab, setInTab] = useState<InTab>('you');
  const [outTab, setOutTab] = useState<OutTab>('compare');
  /** An input to focus once its tab panel is visible (validation, reset). */
  const [focusField, setFocusField] = useState<string | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [v, setV] = useState<Record<AmountKey, string>>(EMPTY);

  const rules = getRules(yearId);
  const L = rules.sectionLabels;
  const senior = age !== 'below60';
  const id = (k: AmountKey) => `${uid}-${k}`;
  const inBase = `${uid}-in`;
  const outBase = `${uid}-out`;

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
  const ageShort = AGES.find((a) => a.value === age)?.label ?? '';
  const filled = (keys: AmountKey[]) => keys.filter((k) => parseAmount(v[k]) > 0).length;
  const moreIncomeOpen = moreIncome || filled(incomeMore) > 0;
  const moreDedOpen = moreDed || filled(dedMore) > 0;
  const dedKeys: AmountKey[] = ['hraExemption', 'c80', 'd80Self', 'd80Parents', 'homeLoanInterest', ...dedMore];
  const dedFilled = filled(dedKeys);

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

  // Focus a field after its tab panel has been un-hidden.
  useEffect(() => {
    if (!focusField) return;
    document.getElementById(focusField)?.focus();
    setFocusField(null);
  }, [focusField, inTab]);

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
      setInTab('income');
      setFocusField(id('salary'));
      return;
    }
    setError('');
    setCalculated(true);
    setOutTab('compare');
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
    setOpenHeads({});
    setCalculated(false);
    setError('');
    setOutTab('compare');
    setInTab('income');
    setFocusField(id('salary'));
  };

  const goTab = (t: InTab) => {
    setInTab(t);
    // Keep the tab row in view when stepping with Back / Next on small screens.
    document.getElementById(tabId(inBase, t))?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
  const inIdx = IN_ORDER.indexOf(inTab);
  const prevTab = inIdx > 0 ? IN_ORDER[inIdx - 1] : null;
  const nextTab = inIdx < IN_ORDER.length - 1 ? IN_ORDER[inIdx + 1] : null;

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

  // Section folds of one itemised receipt.
  const headKeysFor = (rg: Regime) =>
    groupHeads(cmp[rg].lines)
      .map((h, i) => (h.head && h.body.length ? `${rg}:${h.head.key ?? i}` : null))
      .filter((k): k is string => k !== null);
  const allOpenFor = (rg: Regime) => {
    const keys = headKeysFor(rg);
    return keys.length > 0 && keys.every((k) => openHeads[k]);
  };
  const toggleHead = (k: string) => setOpenHeads((s) => ({ ...s, [k]: !s[k] }));
  const setAllFor = (rg: Regime, open: boolean) =>
    setOpenHeads((s) => ({ ...s, ...Object.fromEntries(headKeysFor(rg).map((k) => [k, open])) }));

  const tel = telUrl();
  const resultId = `${uid}-result`;
  const cap = (n: number) => `max ${formatINR(n)}`;
  const oldOnly = 'Only affects the old regime';

  const inTabs: TabItem<InTab>[] = [
    { key: 'you', no: '1', label: IN_NAME.you, meta: `${rules.shortLabel} · ${ageShort}` },
    { key: 'income', no: '2', label: IN_NAME.income, meta: hasIncome ? formatINR(incomeEntered) : 'Start here', done: hasIncome },
    { key: 'ded', no: '3', label: IN_NAME.ded, meta: dedFilled ? `${dedFilled} filled` : 'Old regime · optional', done: dedFilled > 0 },
  ];

  const outTabs: TabItem<OutTab>[] = [
    { key: 'compare', label: 'Comparison' },
    { key: 'old', label: 'Old regime lines' },
    { key: 'new', label: 'New regime lines' },
  ];

  const stepNav = (
    <div className="itc-stepnav">
      {prevTab ? (
        <button type="button" className="btn btn--ghost itc-stepnav__back" onClick={() => goTab(prevTab)}>
          <ArrowLeft aria-hidden="true" /> Back
        </button>
      ) : (
        <span />
      )}
      {nextTab && (
        <button type="button" className="btn btn--ghost itc-stepnav__next" onClick={() => goTab(nextTab)}>
          Next: {IN_NAME[nextTab]} <ArrowRight aria-hidden="true" />
        </button>
      )}
    </div>
  );

  return (
    <div className="itc">
      <div className="ws-calc ws-calc--wide itc-calcgrid">
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
            <p className="ws-sheet__hint">Salary alone is enough to start. Leave blank anything that does not apply.</p>
          </div>

          <TabList base={inBase} label="Calculator steps" tabs={inTabs} active={inTab} onSelect={setInTab} className="itc-intabs" />

          <div className="itc-panels">
            <div {...tabPanelProps(inBase, 'you', inTab)} className="itc-panel">
              <fieldset className="ws-part">
                <legend className="ws-sr">About you</legend>
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
              {stepNav}
            </div>

            <div {...tabPanelProps(inBase, 'income', inTab)} className="itc-panel">
              <fieldset className="ws-part">
                <legend className="ws-sr">Your income</legend>
                <p className="ws-part__intro">Yearly amounts, before tax.</p>
                <div className="itc-salary">
                  {field('salary', 'Gross salary for the year', 'From Form 16 or payslips: total pay before HRA exemption and standard deduction.')}
                </div>
                <div className="ws-grid itc-grid">
                  {field('savingsInterest', 'Savings account interest')}
                  {field('depositInterest', 'FD and other interest')}
                  {field('rentalIncome', 'Rent from a let-out property', 'Less municipal tax. 30% is deducted for you.')}
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
                <div id={`${uid}-more-income`} className="ws-grid itc-grid itc-more-panel" hidden={!moreIncomeOpen}>
                  {field('dividends', 'Dividends')}
                  {field('familyPension', 'Family pension')}
                  {field('stcg111A', `Short-term gains, listed shares (${L.stcg})`, `Taxed at ${pct(rules.special.stcg111ARate)}.`)}
                  {field(
                    'ltcg112A',
                    `Long-term gains, listed shares (${L.ltcg})`,
                    `${pct(rules.special.ltcg112ARate)} above ${formatINR(rules.special.ltcg112AExemption)}.`,
                  )}
                </div>
              </fieldset>
              {stepNav}
            </div>

            <div {...tabPanelProps(inBase, 'ded', inTab)} className="itc-panel">
              <fieldset className="ws-part">
                <legend className="ws-sr">Deductions, old regime only</legend>
                <p className="ws-part__intro">
                  The new regime ignores these. Fill them to see if the old regime works out cheaper. Limits are applied for you.
                </p>
                <div className="ws-grid itc-grid">
                  {field(
                    'hraExemption',
                    'HRA exemption',
                    <>
                      {L.hra} · {oldOnly}. Use the <a href="/tools/hra-calculator">HRA calculator</a>.
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
                    'Home-loan interest, self-occupied',
                    `${L.selfOccupiedInterest} · ${cap(rules.caps.selfOccupiedInterest)} · ${oldOnly}.`,
                  )}
                  <div className="itc-check">
                    <Check checked={parentsSenior} onChange={setParentsSenior}>
                      My parents are 60 or older
                    </Check>
                  </div>
                </div>
                <MoreToggle open={moreDedOpen} onToggle={() => setMoreDed(!moreDedOpen)} controls={`${uid}-more-ded`} count={filled(dedMore)}>
                  More deductions: own NPS, employer NPS
                </MoreToggle>
                <div id={`${uid}-more-ded`} className="itc-more-panel" hidden={!moreDedOpen}>
                  <div className="ws-grid itc-grid">
                    {field('ccd1b', 'Own NPS contribution', `${L.ccd1b} · ${cap(rules.caps.ccd1b)} · ${oldOnly}.`)}
                    {field(
                      'employerNps',
                      'Employer NPS contribution',
                      `${L.ccd2} · Both regimes: up to ${pct(rules.regimes.new.employerNpsPct)} (new) or ${pct(rules.regimes.old.employerNpsPct)} (old) of basic + DA.`,
                    )}
                    {field('basicPlusDA', 'Basic + DA', 'Only for the employer NPS limit. Blank uses gross salary.')}
                  </div>
                </div>
                <p className="ws-note itc-interest-note">
                  Savings interest deduction ({senior ? L.ttb : L.tta}) is applied automatically in the old regime, up to{' '}
                  {formatINR(senior ? rules.caps.ttb : rules.caps.tta)}.
                </p>
              </fieldset>
              {stepNav}
            </div>
          </div>

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

        <section
          className="ws-result ws-result--sticky itc-result"
          ref={resultRef}
          id={resultId}
          aria-labelledby={`${uid}-result-h`}
        >
          <div className="itc-result__head">
            <h2 className="itc-result__title" id={`${uid}-result-h`} ref={headingRef} tabIndex={-1}>
              Your estimate
            </h2>
            {showResult && (
              <span className={`itc-updated${updated ? ' is-shown' : ''}`} aria-hidden="true">
                Updated
              </span>
            )}
          </div>
          {rules.verified.status !== 'verified' && (
            <Notice tone="warn" className="itc-verify">
              <strong>Not yet verified.</strong> {rules.verified.note}
            </Notice>
          )}

          {showResult ? (
            <>
              <TabList base={outBase} label="Result views" tabs={outTabs} active={outTab} onSelect={setOutTab} variant="slip" />

              <div {...tabPanelProps(outBase, 'compare', outTab)} className="itc-outpanel">
                <div className="itc-verdict">
                  <p className="itc-verdict__meta">
                    Verdict · {rules.shortLabel} · Age {ageLong}
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
              </div>

              {regimes.map((rg) => (
                <div key={rg} {...tabPanelProps(outBase, rg, outTab)} className="itc-outpanel">
                  <div className="itc-items__head">
                    <p className="ws-note">Every step of the calculation, head by head. Open a head to see its lines.</p>
                    <button type="button" className="itc-all" onClick={() => setAllFor(rg, !allOpenFor(rg))}>
                      {allOpenFor(rg) ? 'Fold all' : 'Show every line'}
                    </button>
                  </div>
                  <ItemisedSlip rg={rg} b={cmp[rg]} rules={rules} isOpen={(k) => !!openHeads[k]} toggle={toggleHead} />
                </div>
              ))}

              <section className="itc-next" aria-labelledby={`${uid}-next-h`}>
                <h3 id={`${uid}-next-h`} className="itc-next__title">
                  Want this filed? Send it on WhatsApp.
                </h3>
                <p className="itc-next__text">
                  {site.owner.name} checks the figures, tells you which regime to pick and files your return. You get a quote before
                  any work starts.
                </p>
                <ShareOptIn checked={optIn} onChange={setOptIn} label="Include my figures in the WhatsApp message" />
                <div className="itc-next__actions">
                  <FiledCta tool="income tax calculator" details={optIn ? summary : undefined} />
                  <a className="btn btn--ghost" href={tel ?? '/contact'}>
                    <Phone aria-hidden="true" /> Call
                  </a>
                </div>
                <a className="link-arrow itc-next__link" href="/services/income-tax-return-filing">
                  See the ITR filing checklist <ArrowRight aria-hidden="true" />
                </a>
              </section>
            </>
          ) : (
            <div className="itc-waiting">
              <Receipt className="itc-blank" heading={<h3 className="rc__title">Your two receipts print here</h3>} meta={rules.label}>
                <p className="rc-caption itc-empty">Enter your salary in step 2, then press Calculate my tax.</p>
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
