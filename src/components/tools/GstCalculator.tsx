import { useMemo, useState } from 'react';
import { FiledPanel } from './FiledCta';
import { CalcActions, Chips, Drawer, MoneyField, Notice, Segmented } from './sc-fields';
import { BlankSlip, Receipt, RcTotal, useCalcFlow, useSettled, vars } from './receipt';
import { computeGst, formatRate, type GstMode, type SupplyType } from '@/lib/gst/gst';
import { defaultGstRateId, findGstRate, gstRateGroups, gstRates } from '@/lib/gst/rates';
import { formatINR, parseAmount } from '@/lib/format';
import './tools.css';
import './secondary-calculators.css';

const inr = (n: number) => formatINR(n, true);
const main = gstRates.filter((x) => x.group === 'main');
const special = gstRates.filter((x) => x.group === 'special');
const legacy = gstRates.filter((x) => x.group === 'legacy');

export default function GstCalculator() {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const flow = useCalcFlow();
  const [mode, setMode] = useState<GstMode>('exclusive');
  const [supply, setSupply] = useState<SupplyType>('intra');
  const [rateId, setRateId] = useState(defaultGstRateId);
  const [moreRates, setMoreRates] = useState(false);
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

  const answerLabel = mode === 'exclusive' ? 'Total with GST' : 'Taxable value (before GST)';
  const answer = inr(mode === 'exclusive' ? r.grossAmount : r.taxableValue);
  const settled = useSettled(`${answerLabel}: ${answer}. GST at ${formatRate(r.rate)}: ${inr(r.totalTax)} (${split}).`, 700);
  const reprintKey = useSettled(`${r.grossAmount}|${r.taxableValue}|${supply}|${mode}`, 400);

  const body = r.lines.slice(0, -1);
  const otherRate = rate.group !== 'main';

  const calculate = () => {
    if (value <= 0) {
      setError('Enter an amount to calculate GST.');
      document.getElementById('gst-amount')?.focus();
      return;
    }
    setError('');
    flow.run();
  };
  const reset = () => {
    setAmount('');
    setMode('exclusive');
    setSupply('intra');
    setRateId(defaultGstRateId);
    setMoreRates(false);
    setShare(false);
    setError('');
    flow.reset();
    document.getElementById('gst-amount')?.focus();
  };
  const taxShare = r.grossAmount > 0 ? r.totalTax / r.grossAmount : 0;

  return (
    <div className="ws-calc gst">
      <form
        className="ws-sheet"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          calculate();
        }}
        aria-label="GST calculator"
      >
        <div className="ws-sheet__head">
          <span className="ws-sheet__tag">Inputs · One line item</span>
          <p className="ws-sheet__hint">Rupees and paise, as on the invoice.</p>
        </div>

        <Segmented
          legend="What is this amount?"
          name="gst-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'exclusive', label: 'Add GST', sub: 'Price before GST' },
            { value: 'inclusive', label: 'Remove GST', sub: 'Price includes GST' },
          ]}
        />
        <MoneyField
          id="gst-amount"
          label={mode === 'exclusive' ? 'Amount before GST' : 'Amount including GST'}
          value={amount}
          onChange={(v) => {
            setAmount(v);
            if (error) setError('');
          }}
          placeholder="10,000"
          hint="Up to two decimals (paise)."
        />

        <div className="gst-rates">
          <Chips
            legend="GST rate"
            name="gst-rate-main"
            className="gst-chips"
            value={rate.group === 'main' ? rate.id : null}
            onChange={setRateId}
            options={main.map((x) => ({ value: x.id, label: x.label }))}
          />
          <p className="ws-hint gst-rate-eg">
            <strong>{rate.label}</strong>
            {rate.examples ? `: ${rate.examples}.` : '.'} The rate depends on the HSN/SAC code of the item. Check it on
            cbic-gst.gov.in.
          </p>
          <Drawer
            className="gst-more"
            open={moreRates}
            onToggle={setMoreRates}
            title="Special rates"
            sub={otherRate ? `${rate.label} selected` : 'Nil, 0.25%, 3% and the old 12% / 28% slabs'}
          >
            <Chips
              legend={gstRateGroups.special}
              name="gst-rate-special"
              value={rate.group === 'special' ? rate.id : null}
              onChange={setRateId}
              options={special.map((x) => ({ value: x.id, label: x.label }))}
            />
            <Chips
              legend={gstRateGroups.legacy}
              name="gst-rate-legacy"
              value={rate.group === 'legacy' ? rate.id : null}
              onChange={setRateId}
              options={legacy.map((x) => ({ value: x.id, label: formatRate(x.rate) }))}
            />
          </Drawer>
        </div>

        <Segmented
          legend="Place of supply"
          name="gst-supply"
          value={supply}
          onChange={setSupply}
          options={[
            { value: 'intra', label: 'Same state', sub: 'CGST + SGST' },
            { value: 'inter', label: 'Other state', sub: 'IGST' },
          ]}
        />
        {rate.group === 'legacy' && (
          <Notice tone="warn">This slab applied to supplies before 22 Sep 2025. Use it only to check older invoices.</Notice>
        )}
        <CalcActions label="Calculate GST" done={flow.done} onReset={reset} error={error} />
      </form>

      <section className="ws-result" aria-labelledby="gst-result-h">
        <h2 id="gst-result-h" className="ws-result__title" ref={flow.headingRef} tabIndex={-1}>
          Your GST breakdown
        </h2>
        {!flow.done ? (
          <BlankSlip
            title="Your invoice prints here"
            caption="Enter an amount, pick the rate, then press Calculate GST."
            meta={rate.label}
            promise={['The GST amount and the total, to the paisa', 'CGST + SGST or IGST, split for you', 'An invoice-style breakdown you can check against a bill']}
          />
        ) : (
        <div className="ws-shown">
        <p className="ws-sr" aria-live="polite" aria-atomic="true">
          {settled}
        </p>
        <div className="gst-split" aria-hidden="true">
          <span className="gst-split__bar">
            <span className="gst-split__tax" style={vars({ '--s': taxShare })} />
          </span>
          <span className="gst-split__legend">
            <span><i className="gst-key gst-key--value" /> Taxable value {inr(r.taxableValue)}</span>
            <span><i className="gst-key gst-key--tax" /> GST {inr(r.totalTax)}</span>
          </span>
        </div>
        <Receipt
          className="gst-inv"
          heading={
            <h3 id="gst-result-title" className="rc__title">
              Tax invoice, specimen
            </h3>
          }
          meta={
            <>
              <span aria-hidden="true">GSTIN: •••••••••• · </span>
              {supply === 'intra' ? 'Intra-state supply' : 'Inter-state supply'}
            </>
          }
          reprintKey={reprintKey}
          after={<p className="rc-caption gst-inv__foot">Estimate for checking figures. Not a valid tax invoice.</p>}
        >
          <table className="gst-table">
            <caption className="ws-sr">Breakdown</caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col" className="num">
                  Rate
                </th>
                <th scope="col" className="num">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {body.map((l, i) => (
                <tr key={l.label} className={i === body.length - 1 ? 'gst-row--sum' : undefined}>
                  <th scope="row">{l.label}</th>
                  <td className="num">{l.rate !== undefined ? formatRate(l.rate) : ''}</td>
                  <td className="num">{inr(l.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>
                  Total amount (incl. GST)
                </th>
                <td className="num">{inr(r.grossAmount)}</td>
              </tr>
            </tfoot>
          </table>
          <RcTotal
            label={answerLabel}
            figure={answer}
            note={
              <>
                GST at {formatRate(r.rate)}: <strong>{inr(r.totalTax)}</strong> ({split})
              </>
            }
          />
        </Receipt>
        <p className="ws-note">
          Each tax is rounded to the nearest paisa. On a real invoice, rounding is applied per line item or per invoice, so
          totals can differ by a few paise.
        </p>
        <FiledPanel
          tool="GST calculator"
          details={details}
          checked={share}
          onChange={setShare}
          service={{ href: '/services/gst-registration-and-returns', label: 'See GST registration and returns help' }}
        />
        </div>
        )}
      </section>
    </div>
  );
}
