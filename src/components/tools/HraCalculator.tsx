import { useMemo, useState } from 'react';
import { FiledPanel } from './FiledCta';
import { CalcActions, MoneyField, Segmented } from './sc-fields';
import { BlankSlip, Receipt, RcLine, RcLines, RcTotal, useCalcFlow, useSettled } from './receipt';
import { computeHra, hraMetroCities, LANDLORD_PAN_RENT_LIMIT, type HraPeriod } from '@/lib/hra/hra';
import { formatINR, parseAmount } from '@/lib/format';
import './tools.css';
import './secondary-calculators.css';

const inr = (n: number) => formatINR(Math.round(n));

/** A pen loop drawn around the lowest limit. Decorative; the row also says so in text. */
function Ring() {
  return (
    <svg className="hra-ring" viewBox="0 0 120 48" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path
        pathLength={1}
        d="M24 9 C 50 2, 97 3, 110 13 C 121 21, 115 37, 87 42 C 61 47, 23 45, 10 35 C 0 26, 8 12, 31 6 C 40 4, 50 3, 60 3.5"
      />
    </svg>
  );
}

export default function HraCalculator() {
  const [period, setPeriod] = useState<HraPeriod>('monthly');
  const [basic, setBasic] = useState('');
  const [da, setDa] = useState('');
  const [hra, setHra] = useState('');
  const [rent, setRent] = useState('');
  const [error, setError] = useState('');
  const flow = useCalcFlow();
  const [city, setCity] = useState<'metro' | 'non-metro'>('non-metro');
  const [share, setShare] = useState(false);

  const r = useMemo(
    () =>
      computeHra({
        basic: parseAmount(basic),
        da: parseAmount(da),
        hraReceived: parseAmount(hra),
        rentPaid: parseAmount(rent),
        metro: city === 'metro',
        period,
      }),
    [basic, da, hra, rent, city, period],
  );

  const per = period === 'monthly' ? 'a month' : 'a year';
  const hasInput = r.hraReceived > 0;
  const details = share
    ? `HRA estimate (old regime, ${city}): HRA received ${inr(r.hraReceived)} a year, rent ${inr(
        r.rentPaid,
      )} a year, exempt ${inr(r.exempt)}, taxable ${inr(r.taxable)}.`
    : undefined;

  const appliedLimit = r.limits.find((l) => l.id === r.applied);
  const live = useSettled(
    `Estimate: exempt HRA ${inr(r.exempt)} a year, taxable HRA ${inr(r.taxable)}.${
      hasInput && appliedLimit ? ` The lowest limit is ${appliedLimit.label.toLowerCase()}.` : ''
    }`,
    700,
  );
  const reprintKey = useSettled(`${r.exempt}|${r.taxable}|${r.applied}`, 400);

  const calculate = () => {
    const missing = [
      parseAmount(basic) <= 0 && ['hra-basic', 'basic salary'],
      parseAmount(hra) <= 0 && ['hra-received', 'HRA received'],
      parseAmount(rent) <= 0 && ['hra-rent', 'rent paid'],
    ].filter(Boolean) as [string, string][];
    if (missing.length) {
      setError(`Enter your ${missing.map((m) => m[1]).join(', ')} to calculate.`);
      document.getElementById(missing[0][0])?.focus();
      return;
    }
    setError('');
    flow.run();
  };
  const reset = () => {
    setBasic('');
    setDa('');
    setHra('');
    setRent('');
    setPeriod('monthly');
    setCity('non-metro');
    setShare(false);
    setError('');
    flow.reset();
    document.getElementById('hra-basic')?.focus();
  };
  const clearErr = (set: (v: string) => void) => (v: string) => {
    set(v);
    if (error) setError('');
  };

  return (
    <div className="ws-calc hra">
      <form
        className="ws-sheet"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          calculate();
        }}
        aria-label="HRA exemption calculator"
      >
        <div className="ws-sheet__head">
          <span className="ws-sheet__tag">Inputs · From your payslip</span>
          <p className="ws-sheet__hint">Old regime only.</p>
        </div>
        <Segmented
          legend="I am entering amounts"
          name="hra-period"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'monthly', label: 'Per month' },
            { value: 'annual', label: 'Per year' },
          ]}
        />
        <div className="ws-grid">
          <MoneyField id="hra-basic" label={`Basic salary (${per})`} value={basic} onChange={clearErr(setBasic)} placeholder="50,000" />
          <MoneyField
            label={`Dearness allowance (${per})`}
            value={da}
            onChange={setDa}
            hint="Only the part that counts for retirement benefits. Leave blank if none."
          />
          <MoneyField id="hra-received" label={`HRA received (${per})`} value={hra} onChange={clearErr(setHra)} placeholder="20,000" />
          <MoneyField id="hra-rent" label={`Rent paid (${per})`} value={rent} onChange={clearErr(setRent)} placeholder="22,000" />
        </div>
        <Segmented
          legend="City you live in"
          name="hra-city"
          value={city}
          onChange={setCity}
          options={[
            { value: 'metro', label: 'Metro', sub: '50% of salary' },
            { value: 'non-metro', label: 'Non-metro', sub: '40% of salary' },
          ]}
        />
        <p className="ws-note">
          Metro here means {hraMetroCities.cities.join(', ')}. This list may be changing: confirm with your employer or on
          incometax.gov.in before you rely on the 50% limit.
        </p>
        <CalcActions label="Calculate HRA exemption" done={flow.done} onReset={reset} error={error} />
      </form>

      <section className="ws-result" aria-labelledby="hra-result-h">
        <h2 id="hra-result-h" className="ws-result__title" ref={flow.headingRef} tabIndex={-1}>
          Your HRA exemption
        </h2>
        {!flow.done ? (
          <BlankSlip
            title="Your slip prints here"
            caption="Fill in your salary, HRA and rent, then press Calculate HRA exemption."
            meta="Old regime only"
            promise={['How much of your HRA is tax-free', 'All three legal limits, with the lowest one circled', 'The taxable part to show your employer']}
          />
        ) : (
        <div className="ws-shown">
        <p className="ws-sr" aria-live="polite" aria-atomic="true">
          {live}
        </p>
        <Receipt
          className="hra-slip"
          heading={
            <h3 id="hra-result-title" className="rc__title">
              HRA exemption, old regime
            </h3>
          }
          meta={`Per year · ${city === 'metro' ? 'Metro' : 'Non-metro'}`}
          reprintKey={reprintKey}
        >
          <RcLines>
            <RcLine label="Salary used (basic + DA)" value={inr(r.salary)} />
            <RcLine label="HRA received" value={inr(r.hraReceived)} />
            <RcLine label="Rent paid" value={inr(r.rentPaid)} />
          </RcLines>
          <p className="rc-caption" id="hra-limits-cap">
            The exemption is the lowest of these three (per year)
          </p>
          <ol className="hra-limits" aria-labelledby="hra-limits-cap">
            {r.limits.map((l, i) => {
              const applied = hasInput && l.id === r.applied;
              return (
                <li key={l.id} className={`hra-limit${applied ? ' is-applied' : ''}`}>
                  <span className="hra-limit__no" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="hra-limit__label">{l.label}</span>
                  <span className="hra-limit__amt">
                    {inr(l.amount)}
                    {applied && (
                      <>
                        <span className="ws-sr"> (lowest, so this is your exemption)</span>
                        <Ring key={r.applied} />
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          <RcTotal
            label="Exempt HRA for the year (old regime)"
            figure={inr(r.exempt)}
            note={
              <>
                Taxable HRA: <strong>{inr(r.taxable)}</strong>
                {period === 'monthly' && hasInput && <> (about {inr(r.exempt / 12)} exempt a month)</>}
              </>
            }
          />
        </Receipt>
        <ul className="ws-fine">
          {hasInput && r.limits[1].amount === 0 && <li>Your rent is not more than 10% of salary, so no HRA is exempt.</li>}
          <li>
            HRA exemption is available only under the <strong>old tax regime</strong>. Under the new regime all HRA is
            taxable.
          </li>
          {r.landlordPanRequired ? (
            <li>
              Your rent is above {inr(LANDLORD_PAN_RENT_LIMIT)} a year, so your employer will ask for your landlord&rsquo;s
              PAN.
            </li>
          ) : (
            <li>If rent is above {inr(LANDLORD_PAN_RENT_LIMIT)} a year, the landlord&rsquo;s PAN is needed.</li>
          )}
        </ul>
        <FiledPanel
          tool="HRA exemption calculator"
          details={details}
          checked={share}
          onChange={setShare}
          service={{ href: '/services/income-tax-return-filing', label: 'See the ITR filing checklist' }}
        />
        </div>
        )}
      </section>
    </div>
  );
}
