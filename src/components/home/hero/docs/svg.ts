/** Renders document primitives to SVG markup (build time, used by the static poster). */
import type { Prim } from './layouts';

const FAMILY = {
  mono: "'Martian Mono Variable', ui-monospace, Menlo, monospace",
  text: "'Hanken Grotesk Variable', system-ui, sans-serif",
  display: "'Bricolage Grotesque Variable', 'Hanken Grotesk Variable', system-ui, sans-serif",
} as const;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v: number) => (Math.round(v * 100) / 100).toString();

export function primsToSvg(prims: readonly Prim[], opts: { textDetail?: number } = {}): string {
  const minText = opts.textDetail ?? 0;
  let out = '';
  for (const p of prims) {
    switch (p.t) {
      case 'rect': {
        const attrs = [
          `x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}"`,
          p.r ? `rx="${n(p.r)}"` : '',
          `fill="${p.fill ?? 'none'}"`,
          p.stroke ? `stroke="${p.stroke}" stroke-width="${n(p.sw ?? 1)}"` : '',
          p.dash ? `stroke-dasharray="${p.dash.join(' ')}"` : '',
        ];
        out += `<rect ${attrs.filter(Boolean).join(' ')}/>`;
        break;
      }
      case 'line':
        out += `<line x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}" stroke="${p.stroke}" stroke-width="${n(p.sw)}" stroke-linecap="round"${p.dash ? ` stroke-dasharray="${p.dash.join(' ')}"` : ''}/>`;
        break;
      case 'circle':
        out += `<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}" fill="${p.fill ?? 'none'}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${n(p.sw ?? 1)}"` : ''}${p.dash ? ` stroke-dasharray="${p.dash.join(' ')}"` : ''}/>`;
        break;
      case 'text': {
        // Tiny text is invisible at poster size; draw it as a bar to keep the SVG light.
        if (p.size < minText) {
          const w = p.s.length * p.size * 0.52;
          const x = p.anchor === 'middle' ? p.x - w / 2 : p.anchor === 'end' ? p.x - w : p.x;
          out += `<rect x="${n(x)}" y="${n(p.y - p.size * 0.55)}" width="${n(w)}" height="${n(p.size * 0.5)}" rx="${n(p.size * 0.25)}" fill="${p.fill}" opacity="0.28"/>`;
          break;
        }
        const anchor = p.anchor && p.anchor !== 'start' ? ` text-anchor="${p.anchor}"` : '';
        const ls = p.ls ? ` letter-spacing="${n(p.ls * p.size)}"` : '';
        const rot = p.rot ? ` transform="rotate(${n(p.rot)} ${n(p.x)} ${n(p.y)})"` : '';
        out += `<text x="${n(p.x)}" y="${n(p.y)}" font-family="${FAMILY[p.font]}" font-size="${n(p.size)}" font-weight="${p.weight ?? 400}" fill="${p.fill}"${anchor}${ls}${rot}>${esc(p.s)}</text>`;
        break;
      }
    }
  }
  return out;
}
