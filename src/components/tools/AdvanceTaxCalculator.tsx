import { useMemo, useState } from 'react';
import FiledCta from './FiledCta';
import { AmountField, Check, ShareOptIn } from './sc-fields';
import { ADVANCE_TAX_THRESHOLD, computeAdvanceTax, filingMonths } from '@/lib/advance-tax/advance-tax';
import { formatINR, parseAmount } from '@/lib/format';
import './tools.css';
import './secondary-calculators.css';

const inr = (n: number) => formatINR(Math.round(n));
const windows = ['on or before 15 Jun', '16 Jun to 15 Sep', '16 Sep to 15 Dec', '16 Dec to 15 Mar'];

export default function AdvanceTaxCalculator() {
  const [tax, setTax] = useState('100000');
  const [presumptive, setPresumptive] = useState(false);
  const [senior, setSenior] = useState(false);
  const [trackPaid, setTrackPaid] = useState(false);
  const [paid, setPaid] = useState(['', '', '', '']);
  const [filingMonth, setFilingMonth] = useState(4);
  const [share, setShare] = useState(false);

  const r = useMemo(
    () =>
      computeAdvanceTax({
        estimatedTax: parseAmount(tax),
        presumptive,
        seniorNoBusiness: senior && !presumptive,
        paid: trackPaid ? paid.map(parseAmount) : undefined,
        filingMonth,
      }),
    [tax, presumptive, senior, trackPaid, paid, filingMonth],
  );

  const setPaidAt = (i: number) => (v: string) => setPaid((p) => p.map((x, j) => (j === i ? v : x)));
  const interest = r.interest;

  let headline: string;
  if (r.reason === 'nil') headline = 'Enter your estimated tax to see the schedule.';
  else if (r.reason === 'below-threshold')
    headline = `Tax after TDS is below ${inr(ADVANCE_TAX_THRESHOLD)}, so advance tax is not needed.`;
  else if (r.reason === 'senior-exempt')
    headline = 'Resident senior citizens with no business or professional income do not need to pay advance tax.';
  else headline = presumptive ? 'Pay the full amount by 15 March.' : 'Pay in four instalments.';

  const details =
    share && r.liable
      ? [
          `Advance tax estimate: tax after TDS ${inr(r.estimatedTax)}${presumptive ? ' (44AD/44ADA)' : ''}.`,
          `Schedule: ${r.schedule
            .filter((s) => s.instalment > 0)
            .map((s) => `${s.dueDate} ${inr(s.instalment)}`)
            .join(', ')}.`,
          interest
            ? `Paid so far ${inr(interest.totalPaid)}; estimated interest 234C ${inr(interest.total234C)}, 234B ${inr(
                interest.b234.interest,
              )}.`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      : undefined;

  return (
    <div className="calc">
      <form className="calc-form card sc-form" onSubmit={(e) => e.preventDefault()} aria-label="Advance tax planner">
        <AmountField
          label="Estimated tax for the year, after TDS/TCS"
          value={tax}
          onChange={setTax}
          hint="Include cess and surcharge. Use the income tax calculator if you need this figure."
        />
        <Check checked={presumptive} onChange={setPresumptive}>
          My business or professional income is taxed on a presumptive basis (section 44AD / 44ADA)
        </Check>
        {!presumptive && (
          <Check checked={senior} onChange={setSenior}>
            I am a resident senior citizen (60+) with no business or professional income
          </Check>
        )}
        <details className="sc-details" open={trackPaid} onToggle={(e) => setTrackPaid(e.currentTarget.open)}>
          <summary>Already paid some advance tax? Estimate interest</summary>
          <div className="sc-details-body">
            <p className="sc-note">Enter what you paid in each period. Leave blank if nothing was paid.</p>
            <div className="sc-row2">
              {windows.map((w, i) => (
                <AmountField key={w} label={`Paid ${w}`} value={paid[i]} onChange={setPaidAt(i)} />
              ))}
            </div>
            <div className="field">
              <label htmlFor="adv-filing-month">Month you will pay the balance and file your return</label>
              <select
                id="adv-filing-month"
                className="select"
                value={filingMonth}
                onChange={(e) => setFilingMonth(Number(e.target.value))}
              >
                {filingMonths.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m} after the year ends ({i + 1} {i === 0 ? 'month' : 'months'} of 234B interest)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </details>
      </form>

      <section className="calc-result" aria-labelledby="adv-result-title">
        <div className="sc-result">
          <div className="sc-result-head" aria-live="polite" aria-atomic="true">
            <h2 id="adv-result-title" className="result-label">
              {interest ? 'Estimated interest (234B + 234C)' : 'Advance tax for the year'}
            </h2>
            <p className="result-figure sc-fade" key={`${r.estimatedTax}-${interest?.total}-${r.liable}`}>
              {r.liable ? inr(interest ? interest.total : r.estimatedTax) : inr(0)}
            </p>
            <p className="sc-result-sub">{headline}</p>
          </div>
          {r.liable && (
            <div className="sc-result-body">
              <div className="table-wrap">
                <table className="sc-table">
                  <caption>Instalment schedule (estimate)</caption>
                  <thead>
                    <tr>
                      <th scope="col">Due by</th>
                      <th scope="col" className="num">Cumulative</th>
                      <th scope="col" className="num">Pay now</th>
                      {interest && <th scope="col" className="num">Paid by then</th>}
                      {interest && <th scope="col" className="num">234C</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {r.schedule.map((s) => (
                      <tr key={s.id}>
                        <td>{s.dueDate}</td>
                        <td className="num">
                          {s.cumulativePercent}% · {inr(s.cumulativeDue)}
                        </td>
                        <td className="num">{inr(s.instalment)}</td>
                        {interest && <td className="num">{inr(s.paidCumulative ?? 0)}</td>}
                        {interest && <td className="num">{inr(s.interest234C ?? 0)}</td>}
                      </tr>
                    ))}
                  </tbody>
                  {interest && (
                    <tfoot>
                      <tr>
                        <td colSpan={4}>Interest under 234C</td>
                        <td className="num">{inr(interest.total234C)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              {interest && (
                <div className="sc-stats">
                  <div className="sc-stat">
                    <p className="result-label">234C (late instalments)</p>
                    <strong>{inr(interest.total234C)}</strong>
                  </div>
                  <div className="sc-stat">
                    <p className="result-label">234B (under 90% paid)</p>
                    <strong>{inr(interest.b234.interest)}</strong>
                  </div>
                  <div className="sc-stat">
                    <p className="result-label">Balance still due</p>
                    <strong>{inr(Math.max(0, r.estimatedTax - interest.totalPaid))}</strong>
                  </div>
                </div>
              )}
              <ul className="sc-list">
                {interest &&
                  (interest.b234.applies ? (
                    <li>
                      You paid less than 90% of the tax, so 234B is estimated at 1% a month on{' '}
                      {inr(interest.b234.shortfall)} for {interest.b234.months}{' '}
                      {interest.b234.months === 1 ? 'month' : 'months'} (April to {filingMonths[interest.b234.months - 1]}).
                    </li>
                  ) : (
                    <li>You paid at least 90% of the tax, so 234B should not apply.</li>
                  ))}
                {!presumptive && (
                  <li>No 234C interest for June if you paid at least 12% by then, or for September if at least 36%.</li>
                )}
                <li>Interest is worked out on amounts rounded down to the nearest ₹100. This is an estimate only.</li>
                <li>Tax paid by 31 March still counts as advance tax.</li>
              </ul>
            </div>
          )}
          <div className="sc-result-foot">
            <ShareOptIn checked={share} onChange={setShare} />
            <FiledCta tool="advance tax planner" details={details} />
          </div>
        </div>
      </section>
    </div>
  );
}
