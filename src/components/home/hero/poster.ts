/**
 * Build-time SVG poster of the final "filed" composition: a fanned stack, the acknowledgement slip presented
 * in front, and the FILED impression. Uses the exact poses from composition.ts, so when the live canvas takes
 * over it lands on the same picture. Shown before hydration, under reduced motion, and without WebGL.
 */
import { Vector3 } from 'three';
import { HERO } from './engine/config';
import { BOUNDS, deskToRoot, newPose, presentPose, project, shadowOnDesk, sheetToDesk, stackPose, type Pose } from './engine/composition';
import { DOC_H, DOC_W, IMPRESSION_H, IMPRESSION_W, docLayout, impressionLayout } from './docs/layouts';
import { primsToSvg } from './docs/svg';
import { C } from './docs/palette';

const W = HERO.paper.w;
const H = HERO.paper.h;
const _v = new Vector3();

/** Sheet-local logical (u, v) in [0..DOC_W] × [0..DOC_H], y down → paper units (y up). */
const docToPaper = (u: number, v: number): [number, number] => [(u / DOC_W - 0.5) * W, (0.5 - v / DOC_H) * H];

/** Desk point → poster coords (root projected, y flipped for SVG). */
function toSvg(p: Vector3): [number, number] {
  const [x, y] = project(deskToRoot(p, _v));
  return [x, -y];
}

/** Affine matrix mapping a local logical space (w × h) onto the sheet via `local → paper` and `pose`. */
function matrixFor(pose: Pose, map: (u: number, v: number) => [number, number], w: number, h: number): string {
  const pt = (u: number, v: number, z = 0) => {
    const [x, y] = map(u, v);
    return toSvg(sheetToDesk(pose, x, y, z, new Vector3()));
  };
  const o = pt(0, 0);
  const ax = pt(w, 0);
  const ay = pt(0, h);
  const a = [(ax[0] - o[0]) / w, (ax[1] - o[1]) / w];
  const c = [(ay[0] - o[0]) / h, (ay[1] - o[1]) / h];
  const f = (x: number) => (Math.round(x * 1e6) / 1e6).toString();
  return `matrix(${f(a[0])} ${f(a[1])} ${f(c[0])} ${f(c[1])} ${f(o[0])} ${f(o[1])})`;
}

function shadowPath(pose: Pose, lift: number): string {
  const pts = ([[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]] as const).map(([x, y]) => {
    const d = sheetToDesk(pose, x, y, 0, new Vector3());
    d.z += lift;
    return toSvg(shadowOnDesk(d, new Vector3()));
  });
  return `M${pts.map((p) => p.map((v) => v.toFixed(4)).join(' ')).join('L')}Z`;
}

function sheet(pose: Pose, kind: Parameters<typeof docLayout>[0], detail: number, extra = ''): string {
  const layout = docLayout(kind);
  const m = matrixFor(pose, docToPaper, DOC_W, DOC_H);
  return `<g transform="${m}"><rect width="${DOC_W}" height="${DOC_H}" fill="${layout.bg}"/>${primsToSvg(layout.prims, { textDetail: detail })}${extra}<rect width="${DOC_W}" height="${DOC_H}" fill="none" stroke="${C.paperLine}" stroke-width="1"/></g>`;
}

export function posterSvg(): string {
  const n = HERO.stack.posterSheets;
  const kinds = HERO.stack.posterKinds;
  const pose = newPose();
  const parts: string[] = [];
  const shadows: string[] = [];

  // Stack, bottom first (highest slot number is the bottom of the pile).
  for (let slot = n - 1; slot >= 1; slot--) {
    stackPose(slot, n, pose);
    shadows.push(`<path d="${shadowPath(pose, 0.02)}"/>`);
    parts.push(sheet(pose, kinds[(slot - 1) % kinds.length], 9));
  }

  // The presented acknowledgement slip, with its FILED impression.
  presentPose(pose);
  const imp = HERO.impression;
  const cos = Math.cos(imp.angle);
  const sin = Math.sin(imp.angle);
  // impression logical (u, v) → paper units on the slip: centred at (imp.x, imp.y), rotated, sized w × h.
  const impToPaper = (u: number, v: number): [number, number] => {
    const lx = (u / IMPRESSION_W - 0.5) * imp.w;
    const ly = (0.5 - v / IMPRESSION_H) * imp.h;
    return [imp.x + lx * cos - ly * sin, imp.y + lx * sin + ly * cos];
  };
  const impression = `<g transform="${matrixFor(pose, impToPaper, IMPRESSION_W, IMPRESSION_H)}" opacity="${imp.opacity}" filter="url(#gs-ink)">${primsToSvg(impressionLayout())}</g>`;
  shadows.push(`<path d="${shadowPath(pose, 0)}" opacity="0.8"/>`);
  parts.push(sheet(pose, 'ack', 7));
  parts.push(impression);

  const b = BOUNDS;
  const vb = [b.minX, -b.maxY, b.w, b.h].map((v) => v.toFixed(4)).join(' ');
  return `<svg class="hero__poster-svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="hero-poster-title" focusable="false">
<title id="hero-poster-title">A neat stack of tax papers stamped FILED, with an acknowledgement slip on top</title>
<defs>
<filter id="gs-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.025"/></filter>
<filter id="gs-ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.9" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
</defs>
<g fill="#000" opacity="${HERO.desk.shadowOpacity}" filter="url(#gs-soft)">${shadows.join('')}</g>
${parts.join('\n')}
</svg>`;
}
