/**
 * Split-flap "next deadline" board. Sits directly under the hero.
 *
 *   NEXT DEADLINE   [G][S][T][R][-][3][B]   [2][0][ ][O][C][T]   [2][4] DAYS
 *
 * The server render shows a neutral "TAX CALENDAR" state (the build date is not today). After mount the real
 * dates are computed on the client and the flaps cascade to the first deadline, then rotate every few seconds.
 * Flip glyphs are aria-hidden; a polite live region reads the deadline in plain words.
 * Reduced motion: no flipping, text swaps instantly, no auto-rotation.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Pause, Play } from 'lucide-react';
import { daysUntil, upcomingDeadlines, type Deadline } from '@/lib/deadlines/deadlines';
import './FlapBoard.css';

const TITLE_LEN = 12;
const DATE_LEN = 6;
const DAYS_LEN = 3;
const ROTATE_MS = 5500;
/** Characters on the drum, in flip order. */
const DRUM = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/·';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Short board labels for each deadline key (the id suffix after the ISO date). */
const SHORT: Record<string, string> = {
  'tds-pay': 'TDS PAYMENT',
  gstr1: 'GSTR-1',
  'gstr1-qrmp': 'GSTR-1 QRMP',
  gstr3b: 'GSTR-3B',
  'gstr3b-qrmp': 'GSTR-3B QRMP',
  'adv-1': 'ADVANCE TAX',
  'adv-2': 'ADVANCE TAX',
  'adv-3': 'ADVANCE TAX',
  'adv-4': 'ADVANCE TAX',
  'tds-q1': 'TDS RETURN',
  'tds-q2': 'TDS RETURN',
  'tds-q3': 'TDS RETURN',
  'tds-q4': 'TDS RETURN',
  form16: 'FORM 16',
  itr: 'ITR FILING',
  'itr-audit': 'ITR AUDIT',
  'itr-belated': 'BELATED ITR',
  gstr9: 'GSTR-9',
};

interface Row {
  key: string;
  title: string;
  date: string;
  days: string;
  urgent: boolean;
  spoken: string;
  full: string;
}

const pad = (s: string, n: number, align: 'left' | 'right' = 'left') =>
  (align === 'left' ? s.padEnd(n, ' ') : s.padStart(n, ' ')).slice(0, n).toUpperCase();

function toRow(d: Deadline, today: Date): Row {
  const key = d.id.slice(11);
  const short = SHORT[key] ?? d.title.split(' ')[0];
  const [, m, day] = d.date.split('-').map(Number);
  const days = daysUntil(today, d.date);
  const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  return {
    key: d.id,
    title: pad(short, TITLE_LEN),
    date: pad(`${day} ${MONTHS[m - 1]}`, DATE_LEN, 'right'),
    days: pad(String(Math.min(days, 999)), DAYS_LEN, 'right'),
    urgent: days <= 7,
    spoken: `Next deadline: ${d.title}, ${day} ${MONTHS_LONG[m - 1]}, ${when}.`,
    full: d.title,
  };
}

const IDLE: Row = {
  key: 'idle',
  title: pad('TAX CALENDAR', TITLE_LEN),
  date: pad('', DATE_LEN),
  days: pad('', DAYS_LEN),
  urgent: false,
  spoken: '',
  full: 'Upcoming tax and GST due dates',
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(q.matches);
    sync();
    q.addEventListener('change', sync);
    return () => q.removeEventListener('change', sync);
  }, []);
  return reduced;
}

/** One split-flap character. Steps through the drum from its current glyph to `target`. */
function Flap({ target, delay, reduced }: { target: string; delay: number; reduced: boolean }) {
  const [cur, setCur] = useState(target);
  const [next, setNext] = useState<string | null>(null);
  const curRef = useRef(target);

  useEffect(() => {
    // A previous sequence may have been interrupted mid-flip; always start from a settled tile.
    setNext(null);
    if (reduced) {
      curRef.current = target;
      setCur(target);
      return;
    }
    if (target === curRef.current) return;
    // Build the path around the drum (capped, so long jumps still feel snappy).
    const from = Math.max(0, DRUM.indexOf(curRef.current));
    const to = Math.max(0, DRUM.indexOf(target));
    const path: string[] = [];
    for (let i = (from + 1) % DRUM.length; ; i = (i + 1) % DRUM.length) {
      path.push(DRUM[i]);
      if (i === to) break;
    }
    const steps = path.length > 6 ? [...path.slice(0, 2), ...path.slice(-4)] : path;
    const timers: number[] = [];
    let k = 0;
    const flip = () => {
      if (k >= steps.length) return;
      const glyph = steps[k++];
      setNext(glyph);
      timers.push(
        window.setTimeout(() => {
          curRef.current = glyph;
          setCur(glyph);
          setNext(null);
          timers.push(window.setTimeout(flip, 12));
        }, 110),
      );
    };
    timers.push(window.setTimeout(flip, delay));
    return () => timers.forEach(clearTimeout);
  }, [target, delay, reduced]);

  const shown = next ?? cur;
  return (
    <span className="flap" aria-hidden="true">
      <span className="flap__half flap__top"><span>{shown}</span></span>
      <span className="flap__half flap__bottom"><span>{cur}</span></span>
      {next !== null && (
        <>
          <span className="flap__leaf flap__leaf--top" key={`t-${next}`}><span>{cur}</span></span>
          <span className="flap__leaf flap__leaf--bottom" key={`b-${next}`}><span>{next}</span></span>
        </>
      )}
    </span>
  );
}

function Segment({ text, offset, reduced, className }: { text: string; offset: number; reduced: boolean; className?: string }) {
  return (
    <span className={`flap-seg ${className ?? ''}`}>
      {[...text].map((ch, i) => (
        <Flap key={i} target={DRUM.includes(ch) ? ch : ' '} delay={(offset + i) * 38} reduced={reduced} />
      ))}
    </span>
  );
}

export default function FlapBoard() {
  const reduced = usePrefersReducedMotion();
  const [rows, setRows] = useState<Row[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const today = new Date();
    const list = upcomingDeadlines(today, 12)
      .filter((d) => !d.id.endsWith('-iff'))
      // One entry per board label, so the rotation shows variety (e.g. not three GST dates in a row).
      .filter((d, i, all) => all.findIndex((x) => SHORT[x.id.slice(11)] === SHORT[d.id.slice(11)]) === i)
      .slice(0, 4)
      .map((d) => toRow(d, today));
    setRows(list);
  }, []);

  const count = rows.length;
  const next = useCallback(() => count && setIndex((i) => (i + 1) % count), [count]);

  useEffect(() => {
    if (!count || paused || hover || reduced) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') next();
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [count, paused, hover, reduced, next]);

  const row = rows[index] ?? IDLE;
  const position = useMemo(() => (count ? `${index + 1} of ${count}` : ''), [index, count]);

  return (
    <section
      className="flapboard"
      aria-label="Upcoming tax deadlines"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      <div className="flapboard__inner container">
        <p className="flapboard__label">
          <span className="flapboard__dot" aria-hidden="true" />
          Next deadline
        </p>

        <div className="flapboard__board" title={row.full}>
          <Segment text={row.title} offset={0} reduced={reduced} className="flap-seg--title" />
          <span className="flapboard__sep flapboard__sep--first" aria-hidden="true">·</span>
          <Segment text={row.date} offset={TITLE_LEN} reduced={reduced} className="flap-seg--date" />
          <span className="flapboard__sep" aria-hidden="true">·</span>
          <span className={`flapboard__days${row.urgent ? ' is-urgent' : ''}`}>
            <Segment text={row.days} offset={TITLE_LEN + DATE_LEN} reduced={reduced} className="flap-seg--days" />
            <span className="flapboard__unit" aria-hidden="true">{row.key === 'idle' ? '' : 'DAYS'}</span>
          </span>
        </div>

        <p className="visually-hidden" aria-live="polite" aria-atomic="true">
          {row.spoken}
        </p>

        <div className="flapboard__controls">
          {count > 1 && (
            <>
              <button type="button" className="flapboard__btn" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
                {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                <span className="visually-hidden">{paused ? 'Resume rotating deadlines' : 'Pause rotating deadlines'}</span>
              </button>
              <button type="button" className="flapboard__btn" onClick={next}>
                <ChevronRight aria-hidden="true" />
                <span className="visually-hidden">Show next deadline ({position})</span>
              </button>
            </>
          )}
          <a className="flapboard__note" href="/faq" title="Usual statutory dates. Extensions are often notified; check incometax.gov.in and gst.gov.in.">
            Indicative dates
          </a>
        </div>
      </div>
    </section>
  );
}
