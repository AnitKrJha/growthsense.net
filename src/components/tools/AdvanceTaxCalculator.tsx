import { useEffect, useMemo, useState } from 'react';
import { FiledPanel } from './FiledCta';
import { CalcActions, Check, Drawer, MoneyField, Notice, PartLegend, SelectField } from './sc-fields';
import { BlankSlip, Receipt, RcLine, RcLines, RcTotal, Stamp, useCalcFlow, useSettled } from './receipt';
import { ADVANCE_TAX_THRESHOLD, computeAdvanceTax, filingMonths, type ScheduleRow } from '@/lib/advance-tax/advance-tax';
import { formatINR, parseAmount } from '@/lib/format';
import './tools.css';
import './secondary-calculators.css';

const inr = (n: number) => formatINR(Math.round(n));
const windows = ['On or before 15 Jun', '16 Jun to 15 Sep', '16 Sep to 15 Dec', '16 Dec to 15 Mar'];
const MONTH: Record<ScheduleRow['id'], { short: string; long: string; m: number }> = {
  jun: { short: 'Jun', long: 'June', m: 5 },
  sep: { short: 'Sep', long: 'September', m: 8 },
  dec: { short: 'Dec', long: 'December', m: 11 },
  mar: { short: 'Mar', long: 'March', m: 2 },
};

/** Dates of the four instalments in the financial year that contains `today` (April to March). */
function instalmentDates(today: Date) {
  const fyStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const at = (id: ScheduleRow['id']) => new Date(id === 'mar' ? fyStart + 1 : fyStart, MONTH[id].m, 15);
  return { fyStart, at };
}

export default function AdvanceTaxCalculator() {
  const [tax, setTax] = useState('');
  const [error, setError] = useState('');
  const flow = useCalcFlow();
  const [presumptive, setPresumptive] = useState(false);
  const [senior, setSenior] = useState(false);
  const [trackPaid, setTrackPaid] = useState(false);
  const [paid, setPaid] = useState(['', '', '', '']);
  const [filingMonth, setFilingMonth] = useState(4);
  const [share, setShare] = useState(false);
  // Today is only known in the browser (the page is built ahead of time), so the "next" date waits for mount.
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setToday(d);
  }, []);

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

  const cal = today ? instalmentDates(today) : null;
  const fyLabel = cal ? `FY ${cal.fyStart}-${String(cal.fyStart + 1).slice(-2)}` : 'This financial year';
  const nextId = cal && r.liable
    ? r.schedule.find((s) => s.instalment > 0 && cal.at(s.id).getTime() >= today!.getTime())?.id
    : undefined;
  const isPast = (s: ScheduleRow) => !!cal && cal.at(s.id).getTime() < today!.getTime();
  const nextRow = r.schedule.find((s) => s.id === nextId);

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

  const live = useSettled(
    r.liable
      ? `Estimate: ${headline} ${nextRow ? `Next due: ${nextRow.dueDate}, ${inr(nextRow.instalment)}.` : ''}${
          interest ? ` Estimated interest ${inr(interest.total)}.` : ''
        }`
      : headline,
    700,
  );
  const reprintKey = useSettled(`${r.estimatedTax}|${r.liable}|${presumptive}|${interest?.total ?? '-'}`, 400);
  const paidCount = paid.filter((p) => parseAmount(p) > 0).length;

  const calculate = () => {
    if (parseAmount(tax) <= 0) {
      setError('Enter your estimated tax for the year to see the instalments.');
      document.getElementById('adv-tax')?.focus();
      return;
    }
    setError('');
    flow.run();
  };
  const reset = () => {
    setTax('');
    setPresumptive(false);
    setSenior(false);
    setTrackPaid(false);
    setPaid(['', '', '', '']);
    setFilingMonth(4);
    setShare(false);
    setError('');
    flow.reset();
    document.getElementById('adv-tax')?.focus();
  };

  return (
    <div className="ws-calc adv">
      <form
        className="ws-sheet"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          calculate();
        }}
        aria-label="Advance tax planner"
      >
        <div className="ws-sheet__head">
          <span className="ws-sheet__tag">Worksheet · Advance tax</span>
          <p className="ws-sheet__hint">Two steps, then Show my instalments.</p>
        </div>

        <fieldset className="ws-part">
          <PartLegend part="1">Your tax for the year</PartLegend>
          <MoneyField
            id="adv-tax"
            label="Estimated tax for the year, after TDS/TCS"
            value={tax}
            onChange={(v) => {
              setTax(v);
              if (error) setError('');
            }}
            placeholder="1,00,000"
            decimals={false}
            hint={
              <>
                Include cess and surcharge. Not sure? Work it out with the{' '}
                <a href="/tools/income-tax-calculator">income tax calculator</a>, then subtract TDS.
              </>
            }
          />
        </fieldset>

        <fieldset className="ws-part">
          <PartLegend part="2">Your situation</PartLegend>
          <Check checked={presumptive} onChange={setPresumptive}>
            My business or professional income is taxed on a presumptive basis (section 44AD / 44ADA)
          </Check>
          {!presumptive && (
            <Check checked={senior} onChange={setSenior}>
              I am a resident senior citizen (60+) with no business or professional income
            </Check>
          )}
        </fieldset>

        <Drawer
          open={trackPaid}
          onToggle={setTrackPaid}
          title="Already paid some advance tax? Estimate interest"
          sub={paidCount > 0 ? `${paidCount} payment${paidCount === 1 ? '' : 's'} entered` : '234B and 234C, as an estimate'}
        >
          <p className="ws-part__intro">Enter what you paid in each period. Leave blank if nothing was paid.</p>
          <div className="ws-grid">
            {windows.map((w, i) => (
              <MoneyField key={w} label={`Paid ${w.toLowerCase()}`} value={paid[i]} onChange={setPaidAt(i)} decimals={false} />
            ))}
          </div>
          <SelectField
            label="Month you will pay the balance and file your return"
            value={String(filingMonth)}
            onChange={(v) => setFilingMonth(Number(v))}
          >
            {filingMonths.map((m, i) => (
              <option key={m} value={i + 1}>
                {m} after the year ends ({i + 1} {i === 0 ? 'month' : 'months'} of 234B interest)
              </option>
            ))}
          </SelectField>
        </Drawer>
        <CalcActions label="Show my instalments" done={flow.done} onReset={reset} error={error} />
      </form>

      <section className="ws-result" aria-labelledby="adv-result-title">
        <h2 id="adv-result-title" className="ws-result__title" ref={flow.headingRef} tabIndex={-1}>
          Your instalment calendar
        </h2>
        {!flow.done ? (
          <BlankSlip
            title="Your calendar prints here"
            caption="Enter your estimated tax, then press Show my instalments."
            meta={fyLabel}
            promise={['What to pay on 15 June, September, December and March', 'Which due date is next', 'An interest estimate if a payment was missed']}
          />
        ) : (
        <div className="ws-shown">
        <p className="ws-sr" aria-live="polite" aria-atomic="true">
          {live}
        </p>

        <div className="adv-cal">
          <div className="adv-cal__caption">
            <p className="adv-cal__title">Due dates</p>
            <p className="adv-cal__fy">{fyLabel}</p>
          </div>
          <ol className="adv-pages" aria-label="Advance tax due dates">
            {r.schedule.map((s) => {
              const skip = r.liable && s.instalment === 0;
              const next = s.id === nextId;
              const past = r.liable && !next && isPast(s) && s.instalment > 0;
              const cls = ['adv-page', next && 'is-next', past && 'is-past', (skip || !r.liable) && 'is-skip']
                .filter(Boolean)
                .join(' ');
              return (
                <li key={s.id} className={cls}>
                  {next && <span className="adv-page__tag">Next</span>}
                  <span className="adv-page__month" aria-hidden="true">
                    {MONTH[s.id].short}
                  </span>
                  <span className="adv-page__body">
                    <span className="adv-page__day" aria-hidden="true">
                      15
                    </span>
                    <span className="ws-sr">15 {MONTH[s.id].long}{next ? ', next due date' : past ? ', date has passed' : ''}: </span>
                    <span className="adv-page__pct">{r.liable && !skip ? `${s.cumulativePercent}% by now` : 'Nothing due'}</span>
                  </span>
                  <span className="adv-page__amt">
                    {!r.liable ? (
                      'Nil'
                    ) : skip ? (
                      'Not needed'
                    ) : (
                      <>
                        <small>Pay</small>
                        {inr(s.instalment)}
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="ws-note adv-cal__note">
            {presumptive && r.liable
              ? 'With 44AD / 44ADA you can pay the whole amount in one go by 15 March.'
              : 'Amounts are what to pay on each date. Percentages are the total that should be paid by then.'}
          </p>
        </div>

        <Receipt
          heading={
            <h3 className="rc__title">{interest ? 'Interest estimate, 234B + 234C' : 'Advance tax for the year'}</h3>
          }
          meta={presumptive ? 'Presumptive (44AD / 44ADA)' : 'Regular instalments'}
          reprintKey={reprintKey}
          className={interest ? 'adv-interest' : undefined}
          after={
            interest && r.liable && interest.total === 0 ? (
              <div className="adv-slip-after">
                <Stamp top="Interest" main="None due" />
              </div>
            ) : !r.liable && r.reason !== 'nil' ? (
              <div className="adv-slip-after">
                <Stamp top="Advance tax" main="Not needed" />
              </div>
            ) : undefined
          }
        >
          {!r.liable ? (
            <p className="rc-caption">{headline}</p>
          ) : interest ? (
            <>
              <RcLines>
                {r.schedule.map((s) => (
                  <RcLine
                    key={s.id}
                    label={`234C, ${s.dueDate}`}
                    value={inr(s.interest234C ?? 0)}
                    note={s.instalment > 0 ? `Paid by then ${inr(s.paidCumulative ?? 0)}` : undefined}
                  />
                ))}
                <RcLine label="234C total" tone="sub" value={inr(interest.total234C)} />
                <RcLine
                  label={`234B, ${interest.b234.months} month${interest.b234.months === 1 ? '' : 's'}`}
                  value={inr(interest.b234.interest)}
                  note={interest.b234.applies ? `On ${inr(interest.b234.shortfall)} unpaid` : 'At least 90% paid'}
                />
                <RcLine label="Balance still due" value={inr(Math.max(0, r.estimatedTax - interest.totalPaid))} />
              </RcLines>
              <RcTotal label="Estimated interest" figure={inr(interest.total)} />
            </>
          ) : (
            <>
              <RcLines>
                {r.schedule
                  .filter((s) => s.instalment > 0)
                  .map((s) => (
                    <RcLine key={s.id} label={`By ${s.dueDate} (${s.cumulativePercent}%)`} value={inr(s.instalment)} />
                  ))}
              </RcLines>
              <RcTotal label="Advance tax for the year" figure={inr(r.estimatedTax)} note={headline} />
            </>
          )}
        </Receipt>

        {interest && r.liable && (
          <Notice tone="info">
            {interest.b234.applies ? (
              <>
                You paid less than 90% of the tax, so 234B is estimated at 1% a month on {inr(interest.b234.shortfall)} for{' '}
                {interest.b234.months} {interest.b234.months === 1 ? 'month' : 'months'} (April to{' '}
                {filingMonths[interest.b234.months - 1]}).
              </>
            ) : (
              <>You paid at least 90% of the tax, so 234B should not apply.</>
            )}
          </Notice>
        )}

        <ul className="ws-fine">
          {!presumptive && <li>No 234C interest for June if you paid at least 12% by then, or for September if at least 36%.</li>}
          <li>Interest is worked out on amounts rounded down to the nearest ₹100. This is an estimate only.</li>
          <li>Tax paid by 31 March still counts as advance tax. Pay online with challan ITNS 280 on incometax.gov.in.</li>
        </ul>

        <FiledPanel
          tool="advance tax planner"
          details={details}
          checked={share}
          onChange={setShare}
          title="Want help paying advance tax? Send it on WhatsApp."
          service={{ href: '/services/income-tax-return-filing', label: 'See income tax filing help' }}
        />
        </div>
        )}
      </section>
    </div>
  );
}
