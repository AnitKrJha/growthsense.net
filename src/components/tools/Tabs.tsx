import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import './Tabs.css';

/**
 * Accessible tabs for the worksheet calculators (WAI-ARIA tabs pattern, automatic activation):
 * roving tabindex, Left/Right/Home/End, aria-selected / aria-controls. Panels are rendered by the
 * caller with `tabPanelProps` and stay mounted (hidden via the `hidden` attribute) so inputs keep their values.
 */

export interface TabItem<K extends string> {
  key: K;
  /** Visible label, e.g. "Income". */
  label: ReactNode;
  /** Small number/step shown before the label, e.g. "2". */
  no?: string;
  /** Short status under the label, e.g. "₹15,00,000" or "Optional". */
  meta?: ReactNode;
  /** Shows a tick when the step is complete. */
  done?: boolean;
}

export const tabId = (base: string, key: string) => `${base}-tab-${key}`;
export const panelId = (base: string, key: string) => `${base}-panel-${key}`;

export function tabPanelProps(base: string, key: string, active: string) {
  return {
    role: 'tabpanel' as const,
    id: panelId(base, key),
    'aria-labelledby': tabId(base, key),
    hidden: key !== active,
    tabIndex: -1,
  };
}

export function TabList<K extends string>({
  base,
  label,
  tabs,
  active,
  onSelect,
  variant = 'file',
  className,
}: {
  base: string;
  label: string;
  tabs: TabItem<K>[];
  active: K;
  onSelect: (key: K) => void;
  /** "file": worksheet file tabs (inputs). "slip": receipt-style underline tabs (results). */
  variant?: 'file' | 'slip';
  className?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = tabs.length - 1;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = i === last ? 0 : i + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = i === 0 ? last : i - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next < 0) return;
    e.preventDefault();
    const k = tabs[next].key;
    onSelect(k);
    refs.current[k]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={`wt wt--${variant}${className ? ` ${className}` : ''}`}>
      {tabs.map((t, i) => {
        const selected = t.key === active;
        return (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[t.key] = el;
            }}
            type="button"
            role="tab"
            id={tabId(base, t.key)}
            aria-controls={panelId(base, t.key)}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={`wt__tab${selected ? ' is-active' : ''}${t.done ? ' is-done' : ''}`}
            onClick={() => onSelect(t.key)}
            onKeyDown={(e) => move(e, i)}
          >
            <span className="wt__top">
              {t.no && (
                <span className="wt__no" aria-hidden="true">
                  {t.done ? '✓' : t.no}
                </span>
              )}
              <span className="wt__label">
                {t.label}
                {t.done && <span className="ws-sr">, complete</span>}
              </span>
            </span>
            {t.meta && <span className="wt__meta">{t.meta}</span>}
          </button>
        );
      })}
    </div>
  );
}
