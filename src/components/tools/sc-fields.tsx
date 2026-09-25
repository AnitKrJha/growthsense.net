/**
 * Worksheet form pieces shared by every calculator island: ₹ money fields (en-IN grouping on blur, clear
 * button), segmented radio groups with a sliding indicator, radio chips, checkboxes, a smooth drawer and
 * notices. All native inputs, so keyboard behaviour (Tab, arrow keys in radio groups, Space) is the browser's.
 * Styles live in tools.css (`ws-`).
 */
import { useId, useRef, type ReactNode } from 'react';
import { Calculator, ChevronDown, Info, RotateCcw, TriangleAlert, X } from 'lucide-react';
import { formatNumberIN, parseAmount } from '@/lib/format';
import { vars } from './receipt';

const decimalIN = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/** Keeps digits, commas and a decimal point so pasted "₹ 12,00,000" still parses. */
const clean = (s: string) => s.replace(/[^\d.,]/g, '');

export function MoneyField({
  label,
  value,
  onChange,
  hint,
  id: idProp,
  decimals = true,
  placeholder = '0',
  prefix = '₹',
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  hint?: ReactNode;
  id?: string;
  /** false: whole rupees, grouped with formatNumberIN on blur (income tax). true: up to 2 decimals. */
  decimals?: boolean;
  placeholder?: string;
  prefix?: string;
}) {
  const auto = useId();
  const id = idProp ?? auto;
  const input = useRef<HTMLInputElement>(null);
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="ws-field">
      <label className="ws-label" htmlFor={id} id={`${id}-l`}>
        {label}
      </label>
      <div className="ws-money">
        <span className="ws-money__prefix" aria-hidden="true">
          {prefix}
        </span>
        <input
          ref={input}
          id={id}
          className="ws-input ws-money__input"
          type="text"
          inputMode={decimals ? 'decimal' : 'numeric'}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          aria-describedby={hintId}
          value={value}
          onChange={(e) => onChange(clean(e.target.value))}
          onBlur={(e) => {
            const n = parseAmount(e.target.value);
            onChange(n > 0 ? (decimals ? decimalIN.format(n) : formatNumberIN(n)) : '');
          }}
        />
        {value !== '' && (
          <button
            type="button"
            className="ws-money__clear"
            aria-labelledby={`${id}-x ${id}-l`}
            onClick={() => {
              onChange('');
              input.current?.focus();
            }}
          >
            <span id={`${id}-x`} hidden>
              Clear
            </span>
            <X aria-hidden="true" />
          </button>
        )}
      </div>
      {hint && (
        <p className="ws-hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}

export interface SegOption<T extends string> {
  value: T;
  label: string;
  /** Second, smaller line inside the segment, e.g. "CGST + SGST". */
  sub?: string;
}

/** Radio group drawn as a segmented control. The thumb slides to the checked option. */
export function Segmented<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  className = '',
}: {
  legend: string;
  name: string;
  value: T;
  options: readonly SegOption<T>[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const id = useId();
  const i = options.findIndex((o) => o.value === value);
  return (
    <fieldset className={`ws-seg ${className}`}>
      <legend className="ws-seg__legend">{legend}</legend>
      <div className="ws-seg__track" style={vars({ '--n': options.length, '--i': Math.max(i, 0) })}>
        <span className="ws-seg__thumb" aria-hidden="true" data-hidden={i < 0 || undefined} />
        {options.map((o) => (
          <label key={o.value} className="ws-seg__opt">
            <input
              className="ws-seg__input"
              type="radio"
              name={`${name}-${id}`}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span className="ws-seg__face">
              <span className="ws-seg__label">{o.label}</span>
              {o.sub && <span className="ws-seg__sub">{o.sub}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Radio group drawn as pill chips. `value` may match none of the options (another group owns it). */
export function Chips<T extends string>({
  legend,
  legendHidden = false,
  name,
  value,
  options,
  onChange,
  className = '',
}: {
  legend: string;
  legendHidden?: boolean;
  name: string;
  value: T | null;
  options: readonly { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <fieldset className={`ws-chips ${className}`}>
      <legend className={legendHidden ? 'ws-sr' : 'ws-chips__legend'}>{legend}</legend>
      <div className="ws-chips__list">
        {options.map((o) => (
          <label key={o.value} className="ws-chip">
            <input
              type="radio"
              name={`${name}-${id}`}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span className="ws-chip__face">{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  children,
  hint,
  id: idProp,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  hint?: ReactNode;
  id?: string;
}) {
  const auto = useId();
  const id = idProp ?? auto;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="ws-field">
      <label className="ws-label" htmlFor={id}>
        {label}
      </label>
      <div className="ws-selectwrap">
        <select id={id} className="ws-input ws-select" value={value} aria-describedby={hintId} onChange={(e) => onChange(e.target.value)}>
          {children}
        </select>
        <ChevronDown aria-hidden="true" />
      </div>
      {hint && (
        <p className="ws-hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function Check({
  checked,
  onChange,
  children,
  className = '',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`ws-check ${className}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/** The opt-in that controls whether figures are added to the WhatsApp message. Off by default. */
export function ShareOptIn({
  checked,
  onChange,
  label = 'Include these figures in my WhatsApp message (optional)',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <Check checked={checked} onChange={onChange} className="ws-optin">
      {label}
    </Check>
  );
}

/**
 * Disclosure with a smooth height change (grid-template-rows 0fr → 1fr). Closed content is `inert`, so it
 * is out of the tab order and hidden from assistive tech.
 */
export function Drawer({
  title,
  sub,
  open,
  onToggle,
  children,
  className = '',
}: {
  title: ReactNode;
  sub?: ReactNode;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`ws-drawer ${open ? 'is-open' : ''} ${className}`}>
      <button type="button" className="ws-drawer__btn" aria-expanded={open} aria-controls={id} onClick={() => onToggle(!open)}>
        <span className="ws-drawer__text">
          <span className="ws-drawer__title">{title}</span>
          {sub && <span className="ws-drawer__sub">{sub}</span>}
        </span>
        <span className="ws-drawer__icon" aria-hidden="true">
          <ChevronDown />
        </span>
      </button>
      <div className="ws-drawer__panel" id={id} inert={!open}>
        <div className="ws-drawer__inner">
          <div className="ws-drawer__body">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Notice({
  tone = 'warn',
  children,
  className = '',
}: {
  tone?: 'warn' | 'info';
  children: ReactNode;
  className?: string;
}) {
  const Icon = tone === 'warn' ? TriangleAlert : Info;
  return (
    <div className={`ws-notice ws-notice--${tone} ${className}`} role="note">
      <Icon aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

/** Part heading for a fieldset on the worksheet: a mono part letter plus a display title. */
export function PartLegend({ part, children }: { part: string; children: ReactNode }) {
  return (
    <legend className="ws-part__legend">
      <span className="ws-part__no" aria-hidden="true">
        {part}
      </span>
      <span>{children}</span>
    </legend>
  );
}

/**
 * The primary action row at the end of every calculator form: a submit button (the form's onSubmit runs the
 * calculation) and a Reset ghost button. On phones it sticks to the bottom of the form, above the mobile
 * contact bar, until the first result is shown.
 */
export function CalcActions({
  label,
  done,
  onReset,
  error,
}: {
  label: string;
  done: boolean;
  onReset: () => void;
  /** Validation message shown above the buttons (role="alert"). */
  error?: string;
}) {
  return (
    <div className={`ws-actions${done ? '' : ' is-sticky'}`}>
      {error && (
        <p className="ws-error" role="alert">
          {error}
        </p>
      )}
      <div className="ws-actions__row">
        <button type="submit" className="btn btn--primary btn--lg ws-actions__go">
          <Calculator aria-hidden="true" /> {done ? 'Recalculate' : label}
        </button>
        <button type="button" className="btn btn--ghost ws-actions__reset" onClick={onReset}>
          <RotateCcw aria-hidden="true" /> Reset
        </button>
      </div>
    </div>
  );
}
