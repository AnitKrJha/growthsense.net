import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, Search } from 'lucide-react';
import { FiledPanel } from './FiledCta';
import { CalcActions, Chips, MoneyField, Notice, Segmented, SelectField } from './sc-fields';
import { BlankSlip, prefersReducedMotion, Receipt, RcLine, RcLines, RcTotal, useCalcFlow, useSettled } from './receipt';
import { computeTds, findTdsRow, rateFor, searchTds, type PayeeType } from '@/lib/tds/tds';
import { tdsCategories, tdsMeta, tdsRows, type TdsCategory, type TdsRow } from '@/lib/tds/tds-rates';
import { formatINR, parseAmount } from '@/lib/format';
import './tools.css';
import './secondary-calculators.css';

const pct = (n: number | null) => (n === null ? 'Varies' : `${n}%`);
const categoryKeys = Object.keys(tdsCategories) as TdsCategory[];
const computable = tdsRows.filter((r) => r.rateIndividual !== null || r.rateOthers !== null);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wraps words of the search query in <mark>. Plain text otherwise. */
function Hi({ text, query }: { text: string; query: string }): ReactNode {
  const words = query.trim().split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return text;
  const re = new RegExp(`(${words.map(escapeRe).join('|')})`, 'ig');
  const parts = text.split(re);
  return parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : p));
}

function Rate({ value, text }: { value: number | null; text?: string }) {
  if (value === null) return <span className="tds-rate tds-rate--varies">{text ?? 'Varies'}</span>;
  return <span className="tds-rate">{pct(value)}</span>;
}

export default function TdsRateFinder() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<TdsCategory | 'all'>('all');
  const [section, setSection] = useState('194C');
  const [payee, setPayee] = useState<PayeeType>('individual');
  const [amount, setAmount] = useState('');
  const [share, setShare] = useState(false);
  const [error, setError] = useState('');
  const helperTitle = useRef<HTMLHeadingElement>(null);
  const flow = useCalcFlow();

  const rows = useMemo(() => searchTds(query, category), [query, category]);
  const row = findTdsRow(section) ?? computable[0];
  const value = parseAmount(amount);
  const result = computeTds(row, payee, value);
  const rate = rateFor(row, payee);

  const pick = (s: string) => {
    setSection(s);
    const h = helperTitle.current;
    if (!h) return;
    h.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    h.focus({ preventScroll: true });
  };

  const details =
    share && result
      ? `TDS estimate: section ${row.section} (${row.nature}), payee ${
          payee === 'individual' ? 'individual/HUF' : payee === 'company' ? 'company' : 'firm/other'
        }, amount ${formatINR(value)}, TDS at ${result.rate}% = ${formatINR(result.tds)}.`
      : undefined;

  const count = useSettled(
    `Showing ${rows.length} of ${tdsRows.length} sections${category !== 'all' ? ` in ${tdsCategories[category]}` : ''}.`,
    500,
  );
  const live = useSettled(
    result
      ? `Estimate: TDS under section ${row.section} at ${result.rate}% is ${formatINR(result.tds)}.`
      : `Section ${row.section}: the rate varies, so no single amount can be worked out.`,
    700,
  );
  const reprintKey = useSettled(`${row.section}|${payee}|${result?.tds ?? '-'}`, 400);

  const calculate = () => {
    if (rate !== null && value <= 0) {
      setError('Enter the payment amount to calculate TDS.');
      document.getElementById('tds-amount')?.focus();
      return;
    }
    setError('');
    flow.run();
  };
  const reset = () => {
    setSection('194C');
    setPayee('individual');
    setAmount('');
    setShare(false);
    setError('');
    flow.reset();
    document.getElementById('tds-amount')?.focus();
  };

  return (
    <div className="tds">
      <div className="ws-calc" id="tds-helper">
        <form
          className="ws-sheet"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            calculate();
          }}
          aria-labelledby="tds-helper-title"
        >
          <div className="ws-sheet__head">
            <span className="ws-sheet__tag">Worksheet · TDS amount</span>
            <p className="ws-sheet__hint">Choose here, or pick a row in the table below.</p>
          </div>
          <h2 id="tds-helper-title" className="tds-helper__title" ref={helperTitle} tabIndex={-1}>
            Work out the TDS on a payment
          </h2>
          <SelectField label="Section" value={row.section} onChange={setSection}>
            {computable.map((r) => (
              <option key={r.section} value={r.section}>
                {r.section}: {r.nature}
              </option>
            ))}
          </SelectField>
          <Segmented
            legend="Who are you paying?"
            name="tds-payee"
            value={payee}
            onChange={setPayee}
            options={[
              { value: 'individual', label: 'Individual / HUF', sub: pct(row.rateIndividual) },
              { value: 'others', label: 'Firm / other', sub: pct(row.rateOthers) },
              { value: 'company', label: 'Company', sub: pct(rateFor(row, 'company')) },
            ]}
          />
          <MoneyField
            id="tds-amount"
            label="Payment amount"
            value={amount}
            onChange={(v) => {
              setAmount(v);
              if (error) setError('');
            }}
            placeholder="1,00,000"
            hint={`Threshold: ${row.threshold}`}
          />
          <CalcActions label="Calculate TDS" done={flow.done} onReset={reset} error={error} />
        </form>

        <section className="ws-result" aria-labelledby="tds-result-h">
          <h2 id="tds-result-h" className="ws-result__title" ref={flow.headingRef} tabIndex={-1}>
            TDS to deduct
          </h2>
          {!flow.done ? (
            <BlankSlip
              title="Your TDS slip prints here"
              caption="Pick the section, enter the amount, then press Calculate TDS."
              meta={`Section ${row.section} · ${tdsMeta.financialYear}`}
              promise={['The TDS to deduct at the right rate', 'The net amount to pay the payee', 'The threshold and no-PAN rule for that section']}
            />
          ) : (
          <div className="ws-shown">
          <p className="ws-sr" aria-live="polite" aria-atomic="true">
            {live}
          </p>
          <Receipt
            heading={
              <h3 id="tds-result-title" className="rc__title">
                TDS under section {row.section}
              </h3>
            }
            meta={`${payee === 'individual' ? 'Individual / HUF payee' : payee === 'company' ? 'Company payee' : 'Firm / other payee'} · ${tdsMeta.financialYear}`}
            reprintKey={reprintKey}
          >
            {result ? (
              <>
                <RcLines>
                  <RcLine label="Payment amount" value={formatINR(value, true)} />
                  {row.onExcessOver !== undefined && (
                    <RcLine label={`Less first ${formatINR(row.onExcessOver)}`} tone="less" value={`− ${formatINR(Math.min(value, row.onExcessOver), true)}`} />
                  )}
                  <RcLine label="TDS charged on" tone="sub" value={formatINR(result.base, true)} />
                  <RcLine label="Rate" value={`${result.rate}%`} />
                  <RcLine label="Net payable to payee" value={formatINR(result.netPayable, true)} />
                </RcLines>
                <RcTotal label="TDS to deduct" figure={formatINR(result.tds)} note="Rounded to the nearest rupee." />
              </>
            ) : (
              <p className="rc-caption">
                Rate {rate === null ? 'varies' : `${rate}%`}. {row.rateText ?? 'No single rate applies.'}
              </p>
            )}
          </Receipt>
          <Notice tone="warn">
            This helper does not check the threshold for you. If the payee has no PAN: {row.noPan.toLowerCase()}. Surcharge and
            cess are not included.
          </Notice>
          <FiledPanel
            tool="TDS rate finder"
            details={details}
            checked={share}
            onChange={setShare}
            title="Want your TDS handled? Send it on WhatsApp."
            service={{ href: '/services/tds', label: 'See TDS returns and payments help' }}
          />
          </div>
          )}
        </section>
      </div>
      <section className="tds-find" aria-labelledby="tds-find-h">
        <h2 id="tds-find-h" className="tds-find__title">
          All TDS sections
        </h2>
        <p className="ws-note">Search or filter, then press Use on a row to load it into the calculator above.</p>
        <div className="tds-search" role="search">
          <div className="ws-field">
            <label className="ws-label" htmlFor="tds-q">
              Search by section or type of payment
            </label>
            <div className="tds-search__field">
              <Search aria-hidden="true" />
              <input
                id="tds-q"
                className="ws-input"
                type="search"
                placeholder="e.g. 194J, rent, contractor, FD interest"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
          <Chips
            legend="Filter by type of payment"
            name="tds-cat"
            className="tds-filters"
            value={category}
            onChange={setCategory}
            options={[{ value: 'all' as const, label: 'All' }, ...categoryKeys.map((k) => ({ value: k, label: tdsCategories[k] }))]}
          />
          <p className="tds-count" aria-live="polite">
            {count} {tdsMeta.financialYear}, unverified.
          </p>
        </div>

        <div className="tds-ledger-wrap">
          <table className="tds-ledger">
            <caption className="ws-sr">
              TDS rates and thresholds, {tdsMeta.financialYear}. Pick a row to use it in the amount helper below.
            </caption>
            <colgroup>
              <col className="tds-col-sec" />
              <col />
              <col />
              <col className="tds-col-rate" />
              <col className="tds-col-rate" />
              <col className="tds-col-pan" />
              <col className="tds-col-use" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Section</th>
                <th scope="col">Nature of payment</th>
                <th scope="col">Threshold</th>
                <th scope="col">Ind. / HUF</th>
                <th scope="col">Others</th>
                <th scope="col">No PAN</th>
                <th scope="col">
                  <span className="ws-sr">Use in helper</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: TdsRow) => {
                const canUse = r.rateIndividual !== null || r.rateOthers !== null;
                const selected = r.section === row.section;
                const varies = r.rateIndividual === null && r.rateOthers === null;
                return (
                  <tr key={r.section} className={selected ? 'is-selected' : undefined}>
                    <th scope="row">
                      <span className="tds-sec">
                        <span className="tds-sec__no">
                          <Hi text={r.section} query={query} />
                        </span>
                        <span className="tds-sec__new" title="Section number under the Income-tax Act, 2025, from 1 April 2026">
                          New Act: {r.newActRef}
                        </span>
                      </span>
                    </th>
                    <td className="tds-cell-nature" data-label="Nature of payment">
                      <span className="tds-nature">
                        <Hi text={r.nature} query={query} />
                      </span>
                      {r.note && <span className="tds-sub">{r.note}</span>}
                    </td>
                    <td className="tds-cell-threshold tds-muted" data-label="Threshold">
                      {r.threshold}
                    </td>
                    <td data-label="Individual / HUF">
                      {varies ? <Rate value={null} text={r.rateText} /> : <Rate value={r.rateIndividual} />}
                      {!varies && r.rateText && <span className="tds-sub">{r.rateText}</span>}
                    </td>
                    <td data-label="Others">{varies ? <span className="tds-muted">Varies</span> : <Rate value={r.rateOthers} />}</td>
                    <td className="tds-cell-pan tds-muted" data-label="No PAN (206AA)">
                      {r.noPan}
                    </td>
                    <td className="tds-cell-use">
                      {canUse && (
                        <button
                          type="button"
                          className="tds-use"
                          aria-pressed={selected}
                          onClick={() => pick(r.section)}
                          aria-label={`Use section ${r.section} in the TDS amount helper`}
                        >
                          {selected ? 'In use' : 'Use'} <ArrowDown aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="tds-empty">
                    No match. Try a section number like &ldquo;194C&rdquo; or a word like &ldquo;rent&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="ws-note tds-rule">{tdsMeta.noPanRule}</p>

      </section>
    </div>
  );
}
