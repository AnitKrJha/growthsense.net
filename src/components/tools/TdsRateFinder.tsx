import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import FiledCta from './FiledCta';
import { AmountField, Segmented, ShareOptIn } from './sc-fields';
import { computeTds, findTdsRow, rateFor, searchTds, type PayeeType } from '@/lib/tds/tds';
import { tdsCategories, tdsMeta, tdsRows, type TdsCategory, type TdsRow } from '@/lib/tds/tds-rates';
import { formatINR, parseAmount } from '@/lib/format';
import './tools.css';
import './secondary-calculators.css';

const pct = (n: number | null) => (n === null ? 'Varies' : `${n}%`);
const categoryKeys = Object.keys(tdsCategories) as TdsCategory[];
const computable = tdsRows.filter((r) => r.rateIndividual !== null || r.rateOthers !== null);

function RateCell({ row }: { row: TdsRow }) {
  if (row.rateIndividual === null && row.rateOthers === null) return <span>{row.rateText}</span>;
  return (
    <>
      <span className="sc-rate">{pct(row.rateIndividual)}</span>
      {row.rateText && <div className="sc-note">{row.rateText}</div>}
    </>
  );
}

export default function TdsRateFinder() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<TdsCategory | 'all'>('all');
  const [section, setSection] = useState('194C');
  const [payee, setPayee] = useState<PayeeType>('individual');
  const [amount, setAmount] = useState('100000');
  const [share, setShare] = useState(false);

  const rows = useMemo(() => searchTds(query, category), [query, category]);
  const row = findTdsRow(section) ?? computable[0];
  const result = computeTds(row, payee, parseAmount(amount));
  const rate = rateFor(row, payee);

  const pick = (s: string) => {
    setSection(s);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('tds-helper')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const details =
    share && result
      ? `TDS estimate: section ${row.section} (${row.nature}), payee ${
          payee === 'individual' ? 'individual/HUF' : 'other'
        }, amount ${formatINR(parseAmount(amount))}, TDS at ${result.rate}% = ${formatINR(result.tds)}.`
      : undefined;

  return (
    <div className="sc-finder">
      <div className="card sc-toolbar" role="search">
        <div className="field">
          <label htmlFor="tds-q">Search by section or payment</label>
          <div className="sc-search">
            <Search aria-hidden="true" />
            <input
              id="tds-q"
              className="input"
              type="search"
              placeholder="e.g. 194J, rent, contractor, FD interest"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="tds-cat">Type of payment</label>
          <select
            id="tds-cat"
            className="select"
            value={category}
            onChange={(e) => setCategory(e.target.value as TdsCategory | 'all')}
          >
            <option value="all">All types</option>
            {categoryKeys.map((k) => (
              <option key={k} value={k}>
                {tdsCategories[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="sc-note" aria-live="polite">
        Showing {rows.length} of {tdsRows.length} sections ({tdsMeta.financialYear}, unverified).
      </p>

      <div className="table-wrap sc-table-card">
        <table className="sc-table sc-tds-table">
          <caption className="visually-hidden">TDS rates and thresholds, {tdsMeta.financialYear}</caption>
          <thead>
            <tr>
              <th scope="col">Section</th>
              <th scope="col">Nature of payment</th>
              <th scope="col">Threshold</th>
              <th scope="col">Individual / HUF</th>
              <th scope="col">Others</th>
              <th scope="col">No PAN (206AA)</th>
              <th scope="col">New Act (from 1 Apr 2026)</th>
              <th scope="col">
                <span className="visually-hidden">Use in calculator</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const canUse = r.rateIndividual !== null || r.rateOthers !== null;
              return (
                <tr key={r.section} className={r.section === row.section ? 'is-selected' : undefined}>
                  <th scope="row">
                    <span className="sc-section">{r.section}</span>
                  </th>
                  <td className="sc-nature">
                    {r.nature}
                    {r.note && <div className="sc-note">{r.note}</div>}
                  </td>
                  <td>{r.threshold}</td>
                  <td>
                    <RateCell row={r} />
                  </td>
                  <td>
                    {r.rateOthers === null && r.rateIndividual === null ? (
                      <span>Varies</span>
                    ) : (
                      <span className="sc-rate">{pct(r.rateOthers)}</span>
                    )}
                  </td>
                  <td>{r.noPan}</td>
                  <td>
                    <span className="sc-badge sc-badge--warn">{r.newActRef}</span>
                  </td>
                  <td>
                    {canUse && (
                      <button
                        type="button"
                        className="btn btn--ghost sc-pick"
                        onClick={() => pick(r.section)}
                        aria-label={`Use section ${r.section} in the TDS amount helper`}
                      >
                        Use
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="sc-empty">
                  No match. Try a section number like &ldquo;194C&rdquo; or a word like &ldquo;rent&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="sc-note">{tdsMeta.noPanRule}</p>

      <div className="calc" id="tds-helper">
        <form className="calc-form card sc-form" onSubmit={(e) => e.preventDefault()} aria-label="TDS amount helper">
          <h2 className="sc-form-title">TDS amount helper</h2>
          <div className="field">
            <label htmlFor="tds-section">Section</label>
            <select id="tds-section" className="select" value={row.section} onChange={(e) => setSection(e.target.value)}>
              {computable.map((r) => (
                <option key={r.section} value={r.section}>
                  {r.section}: {r.nature}
                </option>
              ))}
            </select>
          </div>
          <Segmented
            legend="Payee"
            name="tds-payee"
            value={payee}
            onChange={setPayee}
            options={[
              { value: 'individual', label: 'Individual / HUF' },
              { value: 'others', label: 'Firm / company / others' },
            ]}
          />
          <AmountField label="Payment amount" value={amount} onChange={setAmount} hint={`Threshold: ${row.threshold}`} />
        </form>

        <section className="calc-result" aria-labelledby="tds-result-title">
          <div className="sc-result">
            <div className="sc-result-head" aria-live="polite" aria-atomic="true">
              <h2 id="tds-result-title" className="result-label">
                TDS under section {row.section} at {rate === null ? 'varies' : `${rate}%`}
              </h2>
              <p className="result-figure sc-fade" key={`${row.section}-${result?.tds}`}>
                {result ? formatINR(result.tds) : 'Varies'}
              </p>
              {result && (
                <p className="sc-result-sub">
                  Net payable after TDS: <strong>{formatINR(result.netPayable, true)}</strong>
                </p>
              )}
            </div>
            <div className="sc-result-body">
              <ul className="sc-list">
                {row.onExcessOver !== undefined && result && (
                  <li>
                    TDS applies only to the part above {formatINR(row.onExcessOver)}: {formatINR(result.base)} here.
                  </li>
                )}
                {row.rateText && <li>{row.rateText}.</li>}
                <li>This does not check the threshold for you. See the threshold above.</li>
                <li>If the payee has no PAN: {row.noPan.toLowerCase()}.</li>
                <li>Rounded to the nearest rupee. Surcharge and cess are not included.</li>
              </ul>
            </div>
            <div className="sc-result-foot">
              <ShareOptIn checked={share} onChange={setShare} />
              <FiledCta tool="TDS rate finder" details={details} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
