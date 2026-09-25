import { useMemo, useState } from 'react';
import FiledCta from './FiledCta';
import { AmountField, Segmented, ShareOptIn } from './sc-fields';
import { computeHra, hraMetroCities, LANDLORD_PAN_RENT_LIMIT, type HraPeriod } from '@/lib/hra/hra';
import { formatINR, parseAmount } from '@/lib/format';
import './tools.css';
import './secondary-calculators.css';

const inr = (n: number) => formatINR(Math.round(n));

export default function HraCalculator() {
  const [period, setPeriod] = useState<HraPeriod>('monthly');
  const [basic, setBasic] = useState('50000');
  const [da, setDa] = useState('');
  const [hra, setHra] = useState('20000');
  const [rent, setRent] = useState('22000');
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

  return (
    <div className="calc">
      <form className="calc-form card sc-form" onSubmit={(e) => e.preventDefault()} aria-label="HRA exemption calculator">
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
        <div className="sc-row2">
          <AmountField label={`Basic salary (${per})`} value={basic} onChange={setBasic} />
          <AmountField
            label={`Dearness allowance (${per})`}
            value={da}
            onChange={setDa}
            hint="Only the part that counts for retirement benefits."
          />
        </div>
        <AmountField label={`HRA received (${per})`} value={hra} onChange={setHra} />
        <AmountField label={`Rent paid (${per})`} value={rent} onChange={setRent} />
        <Segmented
          legend="City you live in"
          name="hra-city"
          value={city}
          onChange={setCity}
          options={[
            { value: 'metro', label: 'Metro (50%)' },
            { value: 'non-metro', label: 'Non-metro (40%)' },
          ]}
        />
        <p className="sc-note">
          Metro here means {hraMetroCities.cities.join(', ')}. This list may be changing: confirm with your employer
          or on incometax.gov.in before you rely on the 50% limit.
        </p>
      </form>

      <section className="calc-result" aria-labelledby="hra-result-title">
        <div className="sc-result">
          <div className="sc-result-head" aria-live="polite" aria-atomic="true">
            <h2 id="hra-result-title" className="result-label">Exempt HRA for the year (old regime)</h2>
            <p className="result-figure sc-fade" key={r.exempt}>{inr(r.exempt)}</p>
            <p className="sc-result-sub">
              Taxable HRA: <strong>{inr(r.taxable)}</strong>
              {period === 'monthly' && hasInput && <> (about {inr(r.exempt / 12)} exempt a month)</>}
            </p>
          </div>
          <div className="sc-result-body">
            <div className="table-wrap">
              <table className="sc-table">
                <caption>The exemption is the lowest of these three (per year)</caption>
                <thead>
                  <tr>
                    <th scope="col">Limit</th>
                    <th scope="col" className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {r.limits.map((l) => {
                    const applied = hasInput && l.id === r.applied;
                    return (
                      <tr key={l.id} className={applied ? 'is-applied' : undefined}>
                        <td>
                          {l.label} {applied && <span className="sc-badge">Applies</span>}
                        </td>
                        <td className="num">{inr(l.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="sc-list">
              <li>Salary used: {inr(r.salary)} a year (basic + DA).</li>
              {hasInput && r.limits[1].amount === 0 && (
                <li>Your rent is not more than 10% of salary, so no HRA is exempt.</li>
              )}
              <li>
                HRA exemption is available only under the <strong>old tax regime</strong>. Under the new regime all
                HRA is taxable.
              </li>
              {r.landlordPanRequired ? (
                <li>
                  Your rent is above {inr(LANDLORD_PAN_RENT_LIMIT)} a year, so your employer will ask for your
                  landlord&rsquo;s PAN.
                </li>
              ) : (
                <li>If rent is above {inr(LANDLORD_PAN_RENT_LIMIT)} a year, the landlord&rsquo;s PAN is needed.</li>
              )}
            </ul>
          </div>
          <div className="sc-result-foot">
            <ShareOptIn checked={share} onChange={setShare} />
            <FiledCta tool="HRA exemption calculator" details={details} />
          </div>
        </div>
      </section>
    </div>
  );
}
