/** Small form pieces shared by the GST, HRA, advance-tax and TDS islands. */
import { useId, type ReactNode } from 'react';

export function AmountField({
  label,
  value,
  onChange,
  hint,
  placeholder = '0',
  prefix = '₹',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  prefix?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="sc-affix">
        <span className="sc-prefix" aria-hidden="true">{prefix}</span>
        <input
          id={id}
          className="input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          aria-describedby={hintId}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        />
      </div>
      {hint && <span id={hintId} className="hint">{hint}</span>}
    </div>
  );
}

export function Segmented<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="sc-group" role="radiogroup" aria-labelledby={`${id}-l`}>
      <p className="sc-group-label" id={`${id}-l`}>{legend}</p>
      <div className="segmented sc-seg">
        {options.map((o) => (
          <label key={o.value}>
            <input
              type="radio"
              name={`${name}-${id}`}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="sc-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/** The opt-in that controls whether figures are added to the WhatsApp message. */
export function ShareOptIn({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="opt-in sc-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>Include these figures in my WhatsApp message (optional)</span>
    </label>
  );
}
