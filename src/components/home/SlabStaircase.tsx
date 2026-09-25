import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { formatINR, formatNumberIN, parseAmount } from '@/lib/format';
import { compareRegimes, defaultYearId, getRules, slabFill } from '@/lib/tax';
import './SlabStaircase.css';

/*
 * Live slab staircase for the home page (forest desk). An isometric SVG of the new-regime slabs: each step
 * is one slab, its height is the rate, and mint "liquid" fills the steps up to the taxable salary.
 * Numbers come from the tax engine (slabFill / compareRegimes); nothing here hard-codes a rate or limit.
 */

// ---- input tuning
const MIN = 300_000;
const MAX = 5_000_000;
const STEP = 25_000;
const START = 1_275_000;
const PRESETS = [700_000, 1_275_000, 1_800_000, 3_000_000];

// ---- geometry tuning (SVG user units)
const W = 64; // slab length along the stair (x)
const D = 46; // stair depth (y)
const H0 = 8; // height of the 0% step
const HK = 500; // extra height per 1.0 of rate (30% → +150)
const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;

const rules = getRules(defaultYearId);
const regimeNew = rules.regimes.new;
const slabs = regimeNew.slabs.below60;
const SD = regimeNew.standardDeduction;
const REBATE_LIMIT = regimeNew.rebate.incomeLimit;
const REBATE_SALARY = REBATE_LIMIT + SD;
const TOP_VISUAL_TO = MAX - SD; // the open-ended top slab is drawn as if it ended here

/** Isometric projection: +x recedes up-right, +y comes forward down-right, +z is up. */
const P = (x: number, y: number, z: number) => [(x + y) * COS, (y - x) * SIN - z] as const;
const pts = (...p: (readonly [number, number])[]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');

const pct = (r: number) => `${+(r * 100).toFixed(1)}%`;
const lakh = (n: number) => `₹${+(n / 100_000).toFixed(2)}L`;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

interface Step {
  i: number;
  from: number;
  to: number;
  rate: number;
  h: number;
  x0: number;
}

const STEPS: Step[] = slabs.map((s, i) => {
  const from = i === 0 ? 0 : (slabs[i - 1].upTo ?? 0);
  return { i, from, to: s.upTo ?? TOP_VISUAL_TO, rate: s.rate, h: H0 + s.rate * HK, x0: i * W };
});
const N = STEPS.length;
const H_MAX = Math.max(...STEPS.map((s) => s.h));

/** x position on the stair for a taxable amount (used for the rebate dimension line). */
function xOf(amount: number): number {
  for (const s of STEPS) {
    if (amount <= s.to) return s.x0 + (clamp(amount - s.from, 0, s.to - s.from) / (s.to - s.from)) * W;
  }
  return N * W;
}
const X_REBATE = xOf(REBATE_LIMIT);

// viewBox from the geometry, with room for labels above and the dimension line below
const VB_X = -18;
const VB_Y = -(N * W * SIN) - H_MAX - 48;
const VB_W = (N * W + D) * COS + 36;
const VB_H = -VB_Y + (D + 40) * SIN + 34;

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}

/** Eases a displayed number toward `target` (the liquid "pours"); jumps when motion is reduced. */
function useTween(target: number, reduce: boolean) {
  const [shown, setShown] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    if (reduce) {
      cur.current = target;
      setShown(target);
      return;
    }
    let raf = 0;
    const tick = () => {
      const d = target - cur.current;
      if (Math.abs(d) < 400) {
        cur.current = target;
        setShown(target);
        return;
      }
      cur.current += d * 0.16;
      setShown(cur.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduce]);
  return shown;
}

export default function SlabStaircase() {
  const uid = useId();
  const reduce = usePrefersReducedMotion();
  const [salary, setSalary] = useState(START);
  const [text, setText] = useState(formatNumberIN(START));
  const [over, setOver] = useState(false);
  const [live, setLive] = useState('');
  const touched = useRef(false);

  const shown = useTween(salary, reduce);

  const fill = useMemo(() => slabFill(Math.max(0, salary - SD), 'new', rules), [salary]);
  const cmp = useMemo(() => compareRegimes({ age: 'below60', salary }, rules), [salary]);
  const tax = fill.totalTax;
  const takeHome = Math.max(0, salary - tax);
  const inRebateZone = salary <= REBATE_SALARY;
  const topStep = [...fill.slabs].reverse().find((s) => s.amountInSlab > 0);

  // Debounced announcement for screen readers (the visible numbers update on every slider tick).
  useEffect(() => {
    if (!touched.current) return;
    const t = setTimeout(() => {
      setLive(`At ${formatINR(salary)} salary, estimated tax ${formatINR(tax)}. Salary after tax ${formatINR(takeHome)}.`);
    }, 600);
    return () => clearTimeout(t);
  }, [salary, tax, takeHome]);

  const commit = (n: number, fromText = false) => {
    touched.current = true;
    const next = clamp(Math.round(n), 0, MAX);
    setOver(fromText && n > MAX);
    setSalary(next);
    if (!fromText) setText(formatNumberIN(next));
  };

  // Per-step fill from the tweened value; at rest, use the engine's exact slab amounts.
  const shownTaxable = Math.max(0, shown - SD);
  const atRest = shown === salary;
  const view = STEPS.map((s, i) => {
    const span = s.to - s.from;
    const amount = atRest ? fill.slabs[i].amountInSlab : clamp(shownTaxable - s.from, 0, span);
    return { ...s, frac: clamp(amount / span, 0, 1), taxIn: amount * s.rate, amount };
  });

  const sliderValue = clamp(salary, MIN, MAX);
  const sliderPct = ((sliderValue - MIN) / (MAX - MIN)) * 100;
  const L = rules.sectionLabels;

  let taxNote: string;
  if (tax === 0 && fill.rebate > 0) taxNote = `Nil. The ${L.rebate} rebate cancels all ${formatINR(fill.rebate)} of slab tax.`;
  else if (tax === 0) taxNote = 'Nil. Your taxable salary sits inside the 0% slab.';
  else if (fill.marginalRelief > 0) taxNote = `Includes ${formatINR(fill.marginalRelief)} of marginal relief, just above the rebate limit.`;
  else {
    const parts = [`${formatINR(fill.slabTax)} slab tax`];
    if (fill.surcharge > 0) parts.push(`${formatINR(fill.surcharge)} surcharge`);
    parts.push(`${formatINR(fill.cess)} cess`);
    taxNote = parts.join(' + ');
  }

  const oldSD = rules.regimes.old.standardDeduction;
  const regimeLine =
    cmp.better === 'equal'
      ? 'Both regimes come out the same here.'
      : `${cmp.better === 'new' ? 'New' : 'Old'} regime is lower by ${formatINR(cmp.saving)}.`;

  const svgLabel = `Staircase of ${N} new-regime slabs. A taxable salary of ${formatINR(fill.taxableIncome)} reaches the ${pct(
    topStep?.rate ?? 0,
  )} slab.`;

  return (
    <div className="st" style={{ '--p': `${sliderPct}%` } as CSSProperties}>
      <div className="st__controls">
        <div className="st__field">
          <label className="st__label" htmlFor={`${uid}-text`} id={`${uid}-label`}>
            Annual salary
            <span className="st__hint">before the {formatINR(SD)} standard deduction</span>
          </label>
          <div className="st__amount">
            <span aria-hidden="true">₹</span>
            <input
              id={`${uid}-text`}
              className="st__text"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              value={text}
              aria-describedby={over ? `${uid}-over` : undefined}
              onChange={(e) => {
                setText(e.target.value);
                commit(parseAmount(e.target.value), true);
              }}
              onBlur={() => setText(formatNumberIN(salary))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setText(formatNumberIN(salary));
              }}
            />
          </div>
        </div>

        <input
          className="st__range"
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={sliderValue}
          aria-labelledby={`${uid}-label`}
          aria-valuetext={formatINR(sliderValue)}
          onChange={(e) => commit(Number(e.target.value))}
        />
        <div className="st__scale" aria-hidden="true">
          <span>{lakh(MIN)}</span>
          <span>{lakh(MAX)}</span>
        </div>
        {over && (
          <p className="st__over" id={`${uid}-over`}>
            This preview stops at {formatINR(MAX)}. The full calculator has no limit.
          </p>
        )}

        <div className="st__presets" role="group" aria-label="Try a salary">
          {PRESETS.map((p) => (
            <button key={p} type="button" className="st__preset" aria-pressed={salary === p} onClick={() => commit(p)}>
              {lakh(p)}
            </button>
          ))}
        </div>
      </div>

      <figure className="st__figure">
        <svg
          className="st__svg"
          viewBox={`${VB_X.toFixed(1)} ${VB_Y.toFixed(1)} ${VB_W.toFixed(1)} ${VB_H.toFixed(1)}`}
          role="img"
          aria-label={svgLabel}
        >
          {/* back to front, so nearer (lower) steps paint over the risers behind them */}
          {[...view].reverse().map((s) => {
            const x1 = s.x0 + W;
            const xe = s.x0 + s.frac * W;
            return (
              <g key={s.i} className={s.frac > 0 ? 'st__step is-filled' : 'st__step'}>
                <polygon className="st__riser" points={pts(P(s.x0, 0, 0), P(s.x0, D, 0), P(s.x0, D, s.h), P(s.x0, 0, s.h))} />
                <polygon className="st__side" points={pts(P(s.x0, D, 0), P(x1, D, 0), P(x1, D, s.h), P(s.x0, D, s.h))} />
                <polygon className="st__top" points={pts(P(s.x0, 0, s.h), P(x1, 0, s.h), P(x1, D, s.h), P(s.x0, D, s.h))} />
                {s.frac > 0 && (
                  <>
                    <polygon className="st__lq-riser" points={pts(P(s.x0, 0, 0), P(s.x0, D, 0), P(s.x0, D, s.h), P(s.x0, 0, s.h))} />
                    <polygon className="st__lq-side" points={pts(P(s.x0, D, 0), P(xe, D, 0), P(xe, D, s.h), P(s.x0, D, s.h))} />
                    <polygon className="st__lq-top" points={pts(P(s.x0, 0, s.h), P(xe, 0, s.h), P(xe, D, s.h), P(s.x0, D, s.h))} />
                    {s.frac < 1 && <polyline className="st__lq-edge" points={pts(P(xe, 0, s.h), P(xe, D, s.h), P(xe, D, 0))} />}
                  </>
                )}
                <polygon className="st__outline" points={pts(P(s.x0, D, 0), P(x1, D, 0), P(x1, D, s.h), P(x1, 0, s.h), P(s.x0, 0, s.h), P(s.x0, 0, 0))} />
              </g>
            );
          })}

          {/* rebate zone: an isometric dimension line along the front edge */}
          {(() => {
            const y = D + 14;
            const a = P(0, y, 0);
            const b = P(X_REBATE, y, 0);
            const m = P(X_REBATE / 2, y + 16, 0);
            return (
              <g className={inRebateZone ? 'st__dim is-on' : 'st__dim'}>
                <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
                <polyline points={pts(P(0, y - 6, 0), P(0, y + 6, 0))} />
                <polyline points={pts(P(X_REBATE, y - 6, 0), P(X_REBATE, y + 6, 0))} />
                <text x={m[0]} y={m[1]} transform={`rotate(-30 ${m[0].toFixed(1)} ${m[1].toFixed(1)})`} textAnchor="middle">
                  ₹0 tax up to {lakh(REBATE_SALARY)} salary
                </text>
              </g>
            );
          })()}

          {/* labels: rate and the tax falling in each slab */}
          {view.map((s) => {
            const [lx, ly] = P(s.x0 + W / 2, D / 2, s.h);
            return (
              <g key={`l${s.i}`} className={s.amount > 0 ? 'st__lbl is-filled' : 'st__lbl'} aria-hidden="true">
                <text className="st__lbl-rate" x={lx} y={ly - 30} textAnchor="middle">
                  {pct(s.rate)}
                </text>
                <text className="st__lbl-tax" x={lx} y={ly - 13} textAnchor="middle">
                  {s.rate === 0 ? 'Nil' : formatINR(Math.round(s.taxIn))}
                </text>
              </g>
            );
          })}
        </svg>
        <figcaption className="st__caption">
          Estimate · {rules.shortLabel} · new regime · salary only, below 60
        </figcaption>
      </figure>

      <div className="st__numbers">
        <div className={tax === 0 ? 'st__big is-zero' : 'st__big'}>
          <p className="st__big-label">Estimated income tax</p>
          <p className="st__big-value">{formatINR(tax)}</p>
          <p className="st__big-note">{taxNote}</p>
          {inRebateZone && salary > SD + (slabs[0].upTo ?? 0) && (
            <p className="st__badge">
              Rebate zone: ₹0 tax up to {formatINR(REBATE_SALARY)} salary
            </p>
          )}
        </div>
        <dl className="st__facts">
          <div>
            <dt>Salary after income tax</dt>
            <dd>
              {formatINR(takeHome)} <span>≈ {formatINR(Math.round(takeHome / 12))} a month</span>
            </dd>
          </div>
          <div>
            <dt>Old vs new regime</dt>
            <dd>
              {regimeLine}{' '}
              <span>
                Old regime counted with only its {formatINR(oldSD)} standard deduction. HRA, 80C or a home loan can change the answer.
              </span>
            </dd>
          </div>
        </dl>

        <details className="st__ledger">
          <summary>Slab by slab</summary>
          <ul>
            {fill.slabs.map((s, i) => (
              <li key={i}>
                <span>
                  {s.to === null ? `Above ${lakh(s.from)}` : `${lakh(s.from)} to ${lakh(s.to)}`} at {pct(s.rate)}
                </span>
                <span>{formatINR(Math.round(s.taxInSlab))}</span>
              </li>
            ))}
          </ul>
        </details>

        <a className="st__cta" href="/tools/income-tax-calculator">
          See the full breakdown <span aria-hidden="true">→</span>
        </a>
        {rules.verified.status !== 'verified' && (
          <p className="st__verify">
            <strong>Not yet verified.</strong> {rules.verified.note}
          </p>
        )}
      </div>

      <p className="st__live" aria-live="polite">
        {live}
      </p>
    </div>
  );
}
