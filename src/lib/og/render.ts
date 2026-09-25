/**
 * Open Graph card renderer (build time only): satori lays out the card, resvg-wasm rasterises it to PNG.
 * 1200×630, the size every major platform (WhatsApp, LinkedIn, X, Facebook, Slack) crops cleanly.
 * The layout echoes the site: a forest "desk", paper artefacts, one rubber stamp.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createElement as h, type ReactNode } from 'react';
import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { site } from '@/config/site';
import { formatPhone } from '@/lib/contact';
import type { OgRoute } from './routes';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Token hex equivalents (satori doesn't parse OKLCH). Keep in sync with src/styles/tokens.css. */
const C = {
  forest950: '#03190f',
  forest900: '#062619',
  forest800: '#0d3926',
  forest700: '#175437',
  mint300: '#9ee3bb',
  paper50: '#fdfaf4',
  paper200: '#eee7d9',
  paper300: '#dbd3c4',
  graphite900: '#151d18',
  graphite500: '#5e6561',
  stamp600: '#c93126',
  carbon600: '#3e559e',
  inkDesk2: '#aec4b7',
};

const root = process.cwd();
const nm = (p: string) => join(root, 'node_modules', p);

let assets: Promise<{ fonts: Parameters<typeof satori>[1]['fonts']; logo: string }> | null = null;
let wasmReady: Promise<void> | null = null;

function loadAssets() {
  assets ??= (async () => {
    const font = (p: string) => readFile(nm(p));
    const [display, display8, text5, text6, textExt, mono5, mono6, logo] = await Promise.all([
      font('@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff'),
      font('@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff'),
      font('@fontsource/hanken-grotesk/files/hanken-grotesk-latin-500-normal.woff'),
      font('@fontsource/hanken-grotesk/files/hanken-grotesk-latin-600-normal.woff'),
      // latin-ext carries ₹ and other symbols missing from the latin subset
      font('@fontsource/hanken-grotesk/files/hanken-grotesk-latin-ext-500-normal.woff'),
      font('@fontsource/martian-mono/files/martian-mono-latin-500-normal.woff'),
      font('@fontsource/martian-mono/files/martian-mono-latin-600-normal.woff'),
      readFile(join(root, 'public/brand/logo-white.png')),
    ]);
    return {
      fonts: [
        { name: 'Bricolage', data: display, weight: 700 as const, style: 'normal' as const },
        { name: 'Bricolage', data: display8, weight: 800 as const, style: 'normal' as const },
        { name: 'Hanken', data: text5, weight: 500 as const, style: 'normal' as const },
        { name: 'Hanken', data: text6, weight: 600 as const, style: 'normal' as const },
        { name: 'Hanken', data: textExt, weight: 500 as const, style: 'normal' as const },
        { name: 'Martian', data: mono5, weight: 500 as const, style: 'normal' as const },
        { name: 'Martian', data: mono6, weight: 600 as const, style: 'normal' as const },
      ],
      logo: `data:image/png;base64,${logo.toString('base64')}`,
    };
  })();
  return assets;
}

function loadWasm() {
  wasmReady ??= readFile(nm('@resvg/resvg-wasm/index_bg.wasm')).then((buf) => initWasm(buf));
  return wasmReady;
}

/* ---------- tiny layout helpers (satori needs display:flex on every multi-child box) ---------- */
type Style = Record<string, string | number>;
const box = (style: Style, ...children: ReactNode[]) => h('div', { style: { display: 'flex', ...style } }, ...children);
const text = (style: Style, content: string) => h('div', { style: { display: 'flex', ...style } }, content);

/** A drawn check mark (no glyph needed): the bottom-right corner of a rotated box. */
const tick = (color: string, w: number, hgt: number) =>
  box({ width: w, height: hgt, marginTop: -3, borderRight: `3px solid ${color}`, borderBottom: `3px solid ${color}`, transform: 'rotate(40deg)' });

/** Title size steps down with length so it never needs more than three lines. */
function titleSize(title: string, hasAccent: boolean) {
  if (hasAccent) return 70;
  const n = title.length;
  if (n <= 22) return 84;
  if (n <= 34) return 72;
  if (n <= 48) return 62;
  return 54;
}

/** Faint ruled lines standing in for form text. */
function lines(widths: number[], color = C.paper300, gap = 13) {
  return box(
    { flexDirection: 'column', gap },
    ...widths.map((w) => box({ width: `${w}%`, height: 7, borderRadius: 4, background: color })),
  );
}

function sheet(style: Style, ...children: ReactNode[]) {
  return box(
    {
      position: 'absolute',
      width: 330,
      height: 420,
      flexDirection: 'column',
      padding: '30px 30px',
      background: C.paper50,
      borderRadius: 3,
      boxShadow: '0 28px 50px -18px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.25)',
      ...style,
    },
    ...children,
  );
}

function stamp(label: string, style: Style = {}) {
  return box(
    {
      position: 'absolute',
      padding: 6,
      border: `5px solid ${C.stamp600}`,
      borderRadius: 10,
      transform: 'rotate(-12deg)',
      opacity: 0.92,
      ...style,
    },
    text(
      {
        padding: '8px 18px',
        border: `2px solid ${C.stamp600}`,
        borderRadius: 5,
        fontFamily: 'Martian',
        fontWeight: 600,
        fontSize: 34,
        letterSpacing: 4,
        color: C.stamp600,
      },
      label,
    ),
  );
}

/** Right-hand artefact per variant: filed stack (home/pages), a labelled folder (services), a receipt (tools). */
function artefact(route: OgRoute) {
  if (route.variant === 'tool') {
    return box(
      { position: 'relative', width: 380, height: 520 },
      sheet(
        { left: 40, top: 30, width: 300, height: 470, transform: 'rotate(4deg)', padding: '30px 28px' },
        text({ fontFamily: 'Martian', fontWeight: 600, fontSize: 18, letterSpacing: 3, color: C.graphite900 }, 'GROWTHSENSE'),
        text({ fontFamily: 'Martian', fontSize: 13, letterSpacing: 2, color: C.graphite500, marginTop: 6 }, `WORKSHEET · ${route.code ?? ''}`),
        box({ height: 2, marginTop: 18, marginBottom: 20, borderTop: `2px dashed ${C.paper300}` }),
        ...[78, 64, 84, 58, 72].map((w) =>
          box(
            { justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
            box({ width: `${w - 30}%`, height: 7, borderRadius: 4, background: C.paper300 }),
            box({ width: '18%', height: 7, borderRadius: 4, background: C.paper300 }),
          ),
        ),
        box({ height: 2, marginTop: 6, marginBottom: 18, borderTop: `2px dashed ${C.paper300}` }),
        box(
          { justifyContent: 'space-between', alignItems: 'center' },
          text({ fontFamily: 'Martian', fontWeight: 600, fontSize: 15, letterSpacing: 2, color: C.graphite900, whiteSpace: 'nowrap' }, 'TOTAL'),
          text({ fontFamily: 'Martian', fontWeight: 600, fontSize: 20, color: C.forest700, whiteSpace: 'nowrap' }, 'INR ••,•••'),
        ),
      ),
      stamp(route.stamp ?? 'ESTIMATE', { left: 60, top: 200, transform: 'rotate(-10deg)' }),
    );
  }

  if (route.variant === 'service') {
    return box(
      { position: 'relative', width: 400, height: 520 },
      sheet({ left: 60, top: 40, transform: 'rotate(6deg)', background: C.paper200 }),
      // manila folder with a tab
      box(
        {
          position: 'absolute',
          left: 20,
          top: 70,
          width: 360,
          height: 430,
          flexDirection: 'column',
          transform: 'rotate(-3deg)',
        },
        box(
          { marginLeft: 26, width: 150, height: 44, background: '#e7d6ac', borderRadius: '10px 10px 0 0', alignItems: 'center', justifyContent: 'center' },
          text({ padding: '3px 10px', background: C.paper50, fontFamily: 'Martian', fontWeight: 600, fontSize: 18, letterSpacing: 2, color: C.graphite900 }, route.code ?? ''),
        ),
        box(
          {
            flexGrow: 1,
            flexDirection: 'column',
            padding: '34px 30px',
            background: '#efdfb7',
            borderRadius: '0 6px 6px 6px',
            boxShadow: '0 30px 50px -18px rgba(0,0,0,0.6)',
          },
          text({ fontFamily: 'Martian', fontSize: 14, letterSpacing: 2, color: '#6b5a33' }, 'DOCUMENT CHECKLIST'),
          box({ height: 18 }),
          ...[70, 82, 60, 76, 54].map((w) =>
            box(
              { alignItems: 'center', gap: 14, marginBottom: 18 },
              box({ width: 22, height: 22, border: `2.5px solid #8a7648`, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
                tick(C.forest700, 7, 12)),
              box({ width: `${w}%`, height: 8, borderRadius: 4, background: '#d8c594' }),
            ),
          ),
        ),
      ),
      stamp(route.stamp ?? 'ON FILE', { left: 150, top: 360 }),
    );
  }

  // home + generic pages: a fanned stack, the top sheet an acknowledgement, stamped FILED
  const top = route.variant === 'home' ? 'ACKNOWLEDGEMENT' : (route.code ?? 'GROWTHSENSE');
  return box(
    { position: 'relative', width: 420, height: 520 },
    sheet({ left: 80, top: 20, transform: 'rotate(8deg)', background: C.paper200 }, lines([60, 90, 80, 70, 85])),
    sheet({ left: 50, top: 40, transform: 'rotate(3deg)' }, lines([50, 88, 76, 92, 64, 80])),
    sheet(
      { left: 20, top: 70, transform: 'rotate(-4deg)' },
      text({ fontFamily: 'Martian', fontWeight: 600, fontSize: top.length > 12 ? 20 : 24, letterSpacing: 3, color: C.forest700, justifyContent: 'center' }, top),
      box({ height: 16 }),
      box(
        { border: `2px solid ${C.carbon600}`, borderRadius: 4, padding: '10px 12px', flexDirection: 'column', gap: 6 },
        text({ fontFamily: 'Martian', fontSize: 11, letterSpacing: 1, color: C.carbon600 }, route.variant === 'home' ? 'ACKNOWLEDGEMENT NO.' : 'REFERENCE'),
        text(
          { fontFamily: 'Martian', fontWeight: 600, fontSize: 18, letterSpacing: 3, color: C.carbon600 },
          route.variant === 'home' ? '•••• •••• •••• •••' : `GS / ${route.code ?? 'FILE'}`,
        ),
      ),
      box({ height: 22 }),
      lines([88, 70, 92, 60, 80]),
    ),
    stamp(route.stamp ?? 'FILED', { left: 130, top: 340 }),
  );
}

function card(route: OgRoute, logo: string) {
  const size = titleSize(route.title, !!route.titleAccent);
  const phone = formatPhone(site.contact.whatsapp);
  const footer = ['growthsense.net', phone ? `WhatsApp ${phone}` : null].filter(Boolean).join('   ·   ');

  return box(
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      position: 'relative',
      background: `radial-gradient(ellipse 900px 520px at 72% 0%, ${C.forest800} 0%, ${C.forest900} 55%, ${C.forest950} 100%)`,
      fontFamily: 'Hanken',
      color: C.paper50,
      overflow: 'hidden',
    },
    // faint ledger rule down the left, like the site's ruled paper
    box({ position: 'absolute', left: 44, top: 0, bottom: 0, width: 2, background: 'rgba(201,49,38,0.35)' }),
    // copy column
    box(
      { position: 'absolute', left: 84, top: 64, width: 660, bottom: 56, flexDirection: 'column' },
      h('img', { src: logo, width: 250, height: Math.round((250 * 129) / 742), style: { display: 'flex' } }),
      box({ height: 44 }),
      box(
        { alignItems: 'center', gap: 14 },
        box({ width: 34, height: 3, borderRadius: 2, background: C.mint300 }),
        text({ fontFamily: 'Martian', fontWeight: 500, fontSize: 19, letterSpacing: 2, color: C.mint300, textTransform: 'uppercase' }, route.kicker),
      ),
      box({ height: 20 }),
      text(
        { fontFamily: 'Bricolage', fontWeight: 800, fontSize: size, lineHeight: 1.0, letterSpacing: -2.5, color: C.paper50, maxWidth: 660 },
        route.title,
      ),
      ...(route.titleAccent
        ? [
            box({ height: 10 }),
            text(
              { fontFamily: 'Bricolage', fontWeight: 700, fontSize: 44, lineHeight: 1.05, letterSpacing: -1.2, color: C.mint300, maxWidth: 660 },
              route.titleAccent,
            ),
          ]
        : []),
      box({ height: 22 }),
      text({ fontSize: 25, lineHeight: 1.4, color: C.inkDesk2, maxWidth: 620, fontWeight: 500 }, route.subtitle),
      box({ flexGrow: 1 }),
      text({ fontFamily: 'Martian', fontWeight: 500, fontSize: 17, letterSpacing: 1, color: C.inkDesk2 }, footer),
    ),
    // artefact
    box({ position: 'absolute', right: 30, top: 60 }, artefact(route)),
  );
}

export async function renderOgPng(route: OgRoute): Promise<Uint8Array> {
  const [{ fonts, logo }] = await Promise.all([loadAssets(), loadWasm()]);
  const svg = await satori(card(route, logo), { width: OG_WIDTH, height: OG_HEIGHT, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH }, font: { loadSystemFonts: false } }).render().asPng();
  return png;
}
