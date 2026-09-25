/**
 * Receipt / acknowledgement-slip pieces shared by every calculator island, plus two small hooks:
 * `useSettled` (debounce a value until typing pauses) and `useReprint` (the 250ms "receipt feed"
 * micro-animation when figures change). No storage, no network. Styles live in tools.css (`rc-`).
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/** Returns `value` once it has stopped changing for `delay` ms. The first render returns it immediately. */
export function useSettled<T>(value: T, delay = 450): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return settled;
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Plays a short "feed" (clip-path + translate) on the returned element whenever `key` changes after the
 * first render. Pass a settled key so it runs once per pause in typing, not on every keystroke.
 */
export function useReprint<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (!el || typeof el.animate !== 'function' || prefersReducedMotion()) return;
    el.animate(
      [
        { clipPath: 'inset(0 0 100% 0)', transform: 'translateY(-0.625rem)' },
        { clipPath: 'inset(0 0 0% 0)', transform: 'translateY(0)' },
      ],
      { duration: 250, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
  }, [key]);
  return ref;
}

/** Custom-property style helper (React's CSSProperties does not know about `--vars`). */
export const vars = (v: Record<string, string | number>) => v as CSSProperties;

/**
 * A printed slip: torn zig-zag edges, a mono header, a "feed" area that reprints when `reprintKey` changes.
 * `heading` should be a real heading element so the result is reachable by heading navigation.
 */
export function Receipt({
  heading,
  brand = 'GrowthSense · Estimate',
  meta,
  reprintKey,
  className = '',
  children,
  after,
  id,
}: {
  heading: ReactNode;
  brand?: ReactNode;
  meta?: ReactNode;
  reprintKey?: unknown;
  className?: string;
  children: ReactNode;
  /** Rendered inside the slip, below the feed (stamps, fine print). Not part of the reprint. */
  after?: ReactNode;
  id?: string;
}) {
  const feed = useReprint<HTMLDivElement>(reprintKey);
  return (
    <div className={`rc ${className}`} id={id}>
      <div className="rc__slip">
        <header className="rc__head">
          <p className="rc__brand">{brand}</p>
          {heading}
          {meta && <p className="rc__meta">{meta}</p>}
        </header>
        <div className="rc__feed" ref={feed}>
          {children}
        </div>
        {after}
      </div>
    </div>
  );
}

export type LineTone = 'item' | 'less' | 'sub' | 'strong';

/** A receipt line with a dotted leader. Must sit inside <RcLines> (a <dl>). */
export function RcLine({
  label,
  value,
  tone = 'item',
  note,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: LineTone;
  note?: ReactNode;
}) {
  return (
    <div className={`rc-line rc-line--${tone}`}>
      <dt>
        <span className="rc-line__label">{label}</span>
      </dt>
      <dd className="rc-line__value">{value}</dd>
      {note && <dd className="rc-line__note">{note}</dd>}
    </div>
  );
}

export function RcLines({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <dl className={`rc-lines ${className}`}>{children}</dl>;
}

/** The big display total at the foot of a slip. `figure` should already be formatted with formatINR. */
export function RcTotal({ label, figure, note }: { label: ReactNode; figure: string; note?: ReactNode }) {
  return (
    <div className="rc-total">
      <p className="rc-total__label">{label}</p>
      <p className="rc-total__fig" style={vars({ '--len': Math.max(figure.length, 5) })}>
        {figure}
      </p>
      {note && <p className="rc-total__note">{note}</p>}
    </div>
  );
}

/** Rubber stamp. Decorative (aria-hidden): always pair it with the same information in text. */
export function Stamp({ top, main, className = '' }: { top: string; main: string; className?: string }) {
  return (
    <span className={`ws-stamp ${className}`} aria-hidden="true" style={vars({ '--len': Math.max(main.length, 6) })}>
      <span className="ws-stamp__top">{top}</span>
      <span className="ws-stamp__main">{main}</span>
    </span>
  );
}

/**
 * The explicit "Calculate" flow shared by every calculator: nothing shows until the first click, then the
 * result heading is scrolled into view and focused. After that, results may update live.
 * Attach `headingRef` to a result heading that is always rendered (give it tabIndex={-1}).
 */
export function useCalcFlow() {
  const [done, setDone] = useState(false);
  const [tick, setTick] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!tick) return;
    const h = headingRef.current;
    if (!h) return;
    h.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    h.focus({ preventScroll: true });
  }, [tick]);
  return {
    done,
    headingRef,
    run: () => {
      setDone(true);
      setTick((t) => t + 1);
    },
    reset: () => setDone(false),
  };
}

/** Empty-state slip shown before the first calculation: a blank receipt plus what the result will contain. */
export function BlankSlip({
  title,
  caption,
  meta,
  promise,
}: {
  title: string;
  caption: string;
  meta?: ReactNode;
  promise: string[];
}) {
  return (
    <div className="ws-waiting">
      <Receipt className="ws-blank" heading={<h3 className="rc__title">{title}</h3>} meta={meta}>
        <p className="rc-caption ws-blank__cap">{caption}</p>
        <div className="ws-blank__lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </Receipt>
      <ul className="ws-promise">
        {promise.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}
