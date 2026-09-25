import { useMemo, useState } from 'react';
import FiledCta from './FiledCta';
import { AmountField, Segmented, ShareOptIn } from './sc-fields';
import { computeGst, formatRate, type GstMode, type SupplyType } from '@/lib/gst/gst';
import { defaultGstRateId, findGstRate, gstRateGroups, gstRates, type GstRateGroup } from '@/lib/gst/rates';
import { formatINR, parseAmount } from '@/lib/format';
import './tools.css';
import './secondary-calculators.css';

const inr = (n: number) => formatINR(n, true);
const groups = Object.keys(gstRateGroups) as GstRateGroup[];

export default function GstCalculator() {
  const [amount, setAmount] = useState('10000');
  const [mode, setMode] = useState<GstMode>('exclusive');
  const [supply, setSupply] = useState<SupplyType>('intra');
  const [rateId, setRateId] = useState(defaultGstRateId);
  const [share, setShare] = useState(false);

  const rate = findGstRate(rateId) ?? findGstRate(defaultGstRateId)!;
  const value = parseAmount(amount);
  const r = useMemo(() => computeGst({ amount: value, rate: rate.rate, mode, supply }), [value, rate.rate, mode, supply]);

  const split =
    supply === 'intra' ? `CGST ${inr(r.cgst)} + SGST ${inr(r.sgst)}` : `IGST ${inr(r.igst)}`;
  const details = share
    ? `GST calculation (${mode === 'exclusive' ? 'GST added' : 'GST removed'}, ${rate.label}): taxable value ${inr(
        r.taxableValue,
      )}, ${split}, total ${inr(r.grossAmount)}.`
    : undefined;

  return (
    <div className="calc">
      <form className="calc-form card sc-form" onSubmit={(e) => e.preventDefault()} aria-label="GST calculator">
        <AmountField
          label={mode === 'exclusive' ? 'Amount before GST' : 'Amount including GST'}
          value={amount}
          onChange={setAmount}
          hint="Up to two decimals (paise)."
        />
        <Segmented
          legend="What is this amount?"
          name="gst-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'exclusive', label: 'Add GST' },
            { value: 'inclusive', label: 'Remove GST' },
          ]}
        />
        <div className="field">
          <label htmlFor="gst-rate">GST rate</label>
          <select id="gst-rate" className="select" value={rateId} onChange={(e) => setRateId(e.target.value)}>
            {groups.map((g) => (
              <optgroup key={g} label={gstRateGroups[g]}>
                {gstRates
                  .filter((x) => x.group === g)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                      {x.examples ? `: ${x.examples}` : ''}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <span className="hint">
            The rate depends on the HSN/SAC code of the item. Check it on cbic-gst.gov.in.
          </span>
        </div>
        <Segmented
          legend="Place of supply"
          name="gst-supply"
          value={supply}
          onChange={setSupply}
          options={[
            { value: 'intra', label: 'Same state (CGST + SGST)' },
            { value: 'inter', label: 'Other state (IGST)' },
          ]}
        />
        {rate.group === 'legacy' && (
          <p className="notice" role="note">
            This slab applied to supplies before 22 Sep 2025. Use it only to check older invoices.
          </p>
        )}
      </form>

      <section className="calc-result" aria-labelledby="gst-result-title">
        <div className="sc-result">
          <div className="sc-result-head" aria-live="polite" aria-atomic="true">
            <h2 id="gst-result-title" className="result-label">
              {mode === 'exclusive' ? 'Total with GST' : 'Taxable value (before GST)'}
            </h2>
            <p className="result-figure sc-fade" key={`${r.grossAmount}-${r.taxableValue}-${supply}`}>
              {inr(mode === 'exclusive' ? r.grossAmount : r.taxableValue)}
            </p>
            <p className="sc-result-sub">
              GST at {formatRate(r.rate)}: <strong>{inr(r.totalTax)}</strong> ({split})
            </p>
          </div>
          <div className="sc-result-body">
            <div className="table-wrap">
              <table className="sc-table">
                <caption>Breakdown</caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col" className="num">Rate</th>
                    <th scope="col" className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {r.lines.slice(0, -1).map((l) => (
                    <tr key={l.label}>
                      <td>{l.label}</td>
                      <td className="num">{l.rate !== undefined ? formatRate(l.rate) : ''}</td>
                      <td className="num">{inr(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Total amount (incl. GST)</td>
                    <td className="num">{inr(r.grossAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="sc-note">
              Each tax is rounded to the nearest paisa. On a real invoice, rounding is applied per line item or
              per invoice, so totals can differ by a few paise.
            </p>
          </div>
          <div className="sc-result-foot">
            <ShareOptIn checked={share} onChange={setShare} />
            <FiledCta tool="GST calculator" details={details} />
          </div>
        </div>
      </section>
    </div>
  );
}
