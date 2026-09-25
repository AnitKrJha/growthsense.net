import { useId, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Check, TriangleAlert } from 'lucide-react';
import FiledCta from '@/components/tools/FiledCta';
import { formatINR, formatNumberIN, parseAmount } from '@/lib/format';
import { compareRegimes } from '@/lib/tax/compute';
import { defaultYearId, getRules, taxYears } from '@/lib/tax/rules';
import type { AgeBracket, BreakdownLine, Regime, TaxBreakdown, TaxInput, YearId } from '@/lib/tax/types';
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

function AmountField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  value: string;
  onChange: (v: string) => void;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="itc-amount">
        <span className="itc-amount__prefix" aria-hidden="true">
          ₹
        </span>
        <input
          id={id}
          className="input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          aria-describedby={hintId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            const n = parseAmount(e.target.value);
            onChange(n > 0 ? formatNumberIN(n) : '');
          }}
        />
      </div>
      {hint && (
        <span className="hint" id={hintId}>
          {hint}
        </span>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="itc-seg-field">
      <legend className="itc-seg-legend">{legend}</legend>
      <div className="segmented itc-seg">
        {options.map((o) => (
          <label key={o.value}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function fmtLine(l: BreakdownLine): string {
  if (l.kind === 'less') return `− ${formatINR(l.amount)}`;
  return formatINR(l.amount);
}

function BreakdownTable({ b, title }: { b: TaxBreakdown; title: string }) {
  return (
    <div className="table-wrap">
      <table className="itc-table">
        <caption className="visually-hidden">{title}</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col" className="num">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {b.lines.map((l) =>
            l.kind === 'heading' ? (
              <tr key={l.key} className="itc-row--heading">
                <th scope="colgroup" colSpan={2}>
                  {l.label}
                </th>
              </tr>
            ) : (
              <tr key={l.key} className={`itc-row--${l.kind}`}>
                <td>
                  {l.label}
                  {l.note && <span className="itc-row__note">{l.note}</span>}
                </td>
                <td className="num">{fmtLine(l)}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function IncomeTaxCalculator() {
  const uid = useId();
  const [yearId, setYearId] = useState<YearId>(defaultYearId);
  const [age, setAge] = useState<AgeBracket>('below60');
  const [parentsSenior, setParentsSenior] = useState(false);
  const [optIn, setOptIn] = useState(false);
  const [v, setV] = useState<Record<AmountKey, string>>({
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
  });

  const rules = getRules(yearId);
  const L = rules.sectionLabels;
  const senior = age !== 'below60';

  const field = (key: AmountKey, label: ReactNode, hint?: ReactNode) => (
    <AmountField
      id={`${uid}-${key}`}
      label={label}
      hint={hint}
      value={v[key]}
      onChange={(val) => setV((s) => ({ ...s, [key]: val }))}
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
  const incomeKeys: AmountKey[] = [
    'salary', 'savingsInterest', 'depositInterest', 'dividends', 'rentalIncome', 'familyPension', 'otherIncome', 'stcg111A', 'ltcg112A',
  ];
  const incomeEntered = incomeKeys.reduce((sum, k) => sum + parseAmount(v[k]), 0);
  const hasIncome = incomeEntered > 0;
  const regimes: Regime[] = ['new', 'old'];
  const ageLong = AGES.find((a) => a.value === age)?.long ?? '';

  const summary = [
    `My estimate (${rules.label}, age ${ageLong}):`,
    `Income entered: ${formatINR(incomeEntered)}`,
    `New regime tax: ${formatINR(cmp.new.totalTax)}`,
    `Old regime tax: ${formatINR(cmp.old.totalTax)}`,
  ].join('\n');

  const notes = [...new Set([...cmp.new.notes, ...cmp.old.notes])];

  return (
    <div className="itc">
      <div className="calc">
        <form className="calc-form card" onSubmit={(e) => e.preventDefault()} aria-label="Income tax inputs">
          <div className="itc-choices">
            <Segmented
              legend="Year"
              name={`${uid}-year`}
              options={taxYears.map((y) => ({ value: y.id, label: y.shortLabel }))}
              value={yearId}
              onChange={setYearId}
            />
            <Segmented legend="Your age" name={`${uid}-age`} options={AGES} value={age} onChange={setAge} />
          </div>
          <p className="itc-year-label small muted">
            {rules.label}, under the Income-tax Act, {rules.act}.
          </p>

          <fieldset>
            <legend>Income</legend>
            {field('salary', 'Gross salary', 'Annual salary before HRA exemption and standard deduction.')}
            <div className="itc-grid">
              {field('savingsInterest', 'Savings account interest')}
              {field('depositInterest', 'FD and other interest')}
              {field('dividends', 'Dividends')}
              {field('rentalIncome', 'Rent from a let-out property', 'Rent received less municipal tax. 30% is deducted for you.')}
              {field('familyPension', 'Family pension')}
              {field('otherIncome', 'Any other income')}
            </div>
          </fieldset>

          <fieldset>
            <legend>Capital gains on listed shares and equity funds</legend>
            <div className="itc-grid">
              {field('stcg111A', `Short-term gains (${L.stcg})`, `Taxed at ${pct(rules.special.stcg111ARate)}.`)}
              {field(
                'ltcg112A',
                `Long-term gains (${L.ltcg})`,
                `${pct(rules.special.ltcg112ARate)} above ${formatINR(rules.special.ltcg112AExemption)}.`,
              )}
            </div>
          </fieldset>

          <details className="itc-more">
            <summary>
              <span>
                <span className="itc-more__title">Deductions (mostly old regime)</span>
                <span className="itc-more__sub">HRA, home loan, {L.c80}, {L.d80}, NPS</span>
              </span>
              <ChevronDown aria-hidden="true" className="itc-more__icon" />
            </summary>
            <div className="itc-more__body">
              <p className="small muted">
                The new regime ignores these, except the employer NPS contribution. Limits are applied for you.
              </p>
              {field(
                'hraExemption',
                `HRA exemption (${L.hra})`,
                <>
                  Work it out with the <a href="/tools/hra-calculator">HRA calculator</a>.
                </>,
              )}
              {field(
                'homeLoanInterest',
                `Home-loan interest, self-occupied (${L.selfOccupiedInterest})`,
                `Up to ${formatINR(rules.caps.selfOccupiedInterest)}.`,
              )}
              <div className="itc-grid">
                {field('c80', `PPF, ELSS, EPF, etc. (${L.c80})`, `Up to ${formatINR(rules.caps.c80)}.`)}
                {field('ccd1b', `Own NPS contribution (${L.ccd1b})`, `Up to ${formatINR(rules.caps.ccd1b)}.`)}
                {field(
                  'd80Self',
                  `Health insurance: self and family (${L.d80})`,
                  `Up to ${formatINR(senior ? rules.caps.d80SelfSenior : rules.caps.d80SelfBelow60)} at your age.`,
                )}
                {field(
                  'd80Parents',
                  `Health insurance: parents (${L.d80})`,
                  `Up to ${formatINR(parentsSenior ? rules.caps.d80ParentsSenior : rules.caps.d80ParentsBelow60)}.`,
                )}
              </div>
              <label className="opt-in itc-check">
                <input type="checkbox" checked={parentsSenior} onChange={(e) => setParentsSenior(e.target.checked)} />
                <span>My parents are 60 or older</span>
              </label>
              <p className="small muted itc-interest-note">
                Savings interest deduction ({senior ? L.ttb : L.tta}) is applied automatically, up to{' '}
                {formatINR(senior ? rules.caps.ttb : rules.caps.tta)}
                {senior ? ' on savings and deposit interest.' : ' on savings account interest.'}
              </p>
              <div className="itc-grid">
                {field(
                  'employerNps',
                  `Employer NPS contribution (${L.ccd2})`,
                  `Allowed in both regimes: up to ${pct(rules.regimes.new.employerNpsPct)} (new) or ${pct(rules.regimes.old.employerNpsPct)} (old) of basic + DA.`,
                )}
                {field('basicPlusDA', 'Basic + DA', 'For the NPS limit. Leave blank to use gross salary.')}
              </div>
            </div>
          </details>
        </form>

        <div className="calc-result">
          <section className="card itc-result" aria-live="polite" aria-labelledby={`${uid}-result-h`}>
            <h2 id={`${uid}-result-h`} className="itc-result__title">
              Your estimate
            </h2>
            {rules.verified.status !== 'verified' && (
              <p className="notice itc-verify">
                <TriangleAlert aria-hidden="true" />
                <span>
                  <strong>Not yet verified.</strong> {rules.verified.note}
                </span>
              </p>
            )}

            {hasIncome ? (
              <div key={`${yearId}-${cmp.new.totalTax}-${cmp.old.totalTax}`} className="itc-fade">
                <div className="compare">
                  {regimes.map((rg) => {
                    const b = cmp[rg];
                    const better = cmp.better === rg;
                    return (
                      <div key={rg} className={better ? 'is-better' : undefined}>
                        <p className="result-label">
                          {REGIME_NAME[rg]}
                          {better && (
                            <span className="itc-badge">
                              <Check aria-hidden="true" /> Lower tax
                            </span>
                          )}
                        </p>
                        <p className="result-figure">{formatINR(b.totalTax)}</p>
                        <p className="itc-sub">
                          Taxable income {formatINR(b.totalIncome)}
                          <br />
                          Effective rate {(b.effectiveRate * 100).toFixed(1)}%
                        </p>
                      </div>
                    );
                  })}
                </div>
                <p className="itc-save">
                  {cmp.better === 'equal' ? (
                    <>Both regimes give the same tax.</>
                  ) : (
                    <>
                      You save <strong>{formatINR(cmp.saving)}</strong> with the {cmp.better} regime.
                    </>
                  )}
                </p>
                {notes.length > 0 && (
                  <ul className="itc-notes small">
                    {notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="muted itc-empty">Enter your income to compare the new and old regimes.</p>
            )}
          </section>

          <div className="card itc-cta">
            <label className="opt-in itc-check">
              <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
              <span>Include my figures in the WhatsApp message</span>
            </label>
            <FiledCta tool="income tax calculator" details={optIn && hasIncome ? summary : undefined} />
          </div>
        </div>
      </div>

      {hasIncome && (
        <div className="itc-breakdowns">
          <h2 className="itc-breakdowns__title">Full breakdown</h2>
          <div className="itc-breakdowns__grid">
            {regimes.map((rg) => (
              <details key={rg} className="itc-more itc-bd" open={cmp.better === rg || (cmp.better === 'equal' && rg === 'new')}>
                <summary>
                  <span>
                    <span className="itc-more__title">{REGIME_NAME[rg]}</span>
                    <span className="itc-more__sub">Tax payable {formatINR(cmp[rg].totalTax)}</span>
                  </span>
                  <ChevronDown aria-hidden="true" className="itc-more__icon" />
                </summary>
                <div className="itc-bd__body">
                  <BreakdownTable b={cmp[rg]} title={`${REGIME_NAME[rg]} breakdown, ${rules.label}`} />
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
