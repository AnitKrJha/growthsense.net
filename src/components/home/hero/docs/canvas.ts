/** Renders document primitives onto a 2D canvas (client only). */
import type { DocLayout, Prim } from './layouts';
import { DOC_H, DOC_W } from './layouts';
import { C } from './palette';

export const FONT_FAMILY = {
  mono: '"Martian Mono Variable", ui-monospace, Menlo, monospace',
  text: '"Hanken Grotesk Variable", system-ui, sans-serif',
  display: '"Bricolage Grotesque Variable", "Hanken Grotesk Variable", system-ui, sans-serif',
} as const;

/** Make sure the webfonts are ready before we bake them into textures (glyphs incl. ₹ and •). */
export async function loadDocFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const sample = 'FORM ₹ •✓ Aa0';
  await Promise.all(
    [
      `700 16px ${FONT_FAMILY.mono}`,
      `500 16px ${FONT_FAMILY.mono}`,
      `600 16px ${FONT_FAMILY.text}`,
      `700 16px ${FONT_FAMILY.display}`,
    ].map((f) => document.fonts.load(f, sample).catch(() => [])),
  );
}

export function drawPrims(ctx: CanvasRenderingContext2D, prims: readonly Prim[]) {
  for (const p of prims) {
    ctx.save();
    switch (p.t) {
      case 'rect': {
        ctx.beginPath();
        if (p.r) ctx.roundRect(p.x, p.y, p.w, p.h, p.r);
        else ctx.rect(p.x, p.y, p.w, p.h);
        if (p.fill) {
          ctx.fillStyle = p.fill;
          ctx.fill();
        }
        if (p.stroke) {
          ctx.strokeStyle = p.stroke;
          ctx.lineWidth = p.sw ?? 1;
          ctx.setLineDash(p.dash ?? []);
          ctx.stroke();
        }
        break;
      }
      case 'line': {
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.strokeStyle = p.stroke;
        ctx.lineWidth = p.sw;
        ctx.lineCap = 'round';
        ctx.setLineDash(p.dash ?? []);
        ctx.stroke();
        break;
      }
      case 'circle': {
        ctx.beginPath();
        ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
        if (p.fill) {
          ctx.fillStyle = p.fill;
          ctx.fill();
        }
        if (p.stroke) {
          ctx.strokeStyle = p.stroke;
          ctx.lineWidth = p.sw ?? 1;
          ctx.setLineDash(p.dash ?? []);
          ctx.stroke();
        }
        break;
      }
      case 'text': {
        ctx.translate(p.x, p.y);
        if (p.rot) ctx.rotate((p.rot * Math.PI) / 180);
        ctx.font = `${p.weight ?? 400} ${p.size}px ${FONT_FAMILY[p.font]}`;
        ctx.fillStyle = p.fill;
        ctx.textAlign = p.anchor === 'middle' ? 'center' : p.anchor === 'end' ? 'right' : 'left';
        ctx.textBaseline = 'alphabetic';
        if (p.ls) {
          // letterSpacing is widely supported now; guard for older engines.
          (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${p.ls * p.size}px`;
        }
        ctx.fillText(p.s, 0, 0);
        break;
      }
    }
    ctx.restore();
  }
}

/** Paper grain + a faint fold, so sheets don't read as flat vector cards. */
function paperFinish(ctx: CanvasRenderingContext2D, seed: number) {
  let a = seed * 9301 + 49297;
  const rand = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
  ctx.save();
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = rand() > 0.5 ? '#000' : '#8a7a5a';
    ctx.fillRect(rand() * DOC_W, rand() * DOC_H, 0.8, 0.8);
  }
  ctx.restore();
  // horizontal fold at one third, like a letter that was posted
  const fy = DOC_H * (0.33 + (seed % 3) * 0.005);
  const g = ctx.createLinearGradient(0, fy - 6, 0, fy + 6);
  g.addColorStop(0, 'rgba(120,100,60,0)');
  g.addColorStop(0.5, 'rgba(120,100,60,0.07)');
  g.addColorStop(0.51, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, fy - 6, DOC_W, 12);
  // soft vignette toward the edges
  const v = ctx.createRadialGradient(DOC_W / 2, DOC_H / 2, DOC_H * 0.3, DOC_W / 2, DOC_H / 2, DOC_H * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(90,70,40,0.07)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, DOC_W, DOC_H);
}

/** Draw a full document into a new canvas `pxH` device pixels tall. */
export function renderDoc(layout: DocLayout, pxH: number, seed = 1): HTMLCanvasElement {
  const scale = pxH / DOC_H;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(DOC_W * scale);
  canvas.height = Math.round(pxH);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = layout.bg;
  ctx.fillRect(0, 0, DOC_W, DOC_H);
  drawPrims(ctx, layout.prims);
  paperFinish(ctx, seed);
  return canvas;
}

/** Plain back of a sheet: paper colour with grain and a ghost of the print showing through. */
export function renderBack(pxH: number): HTMLCanvasElement {
  const scale = pxH / DOC_H / 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(DOC_W * scale);
  canvas.height = Math.round(DOC_H * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = C.paperShade;
  ctx.fillRect(0, 0, DOC_W, DOC_H);
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = C.ink;
  for (let y = 70; y < DOC_H - 60; y += 14) ctx.fillRect(24 + ((y * 7) % 40), y, 300 - ((y * 13) % 120), 3);
  ctx.globalAlpha = 1;
  paperFinish(ctx, 11);
  return canvas;
}

/** Transparent canvas with the stamp artwork. */
export function renderPrims(prims: readonly Prim[], w: number, h: number, pxW: number): HTMLCanvasElement {
  const scale = pxW / w;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  drawPrims(ctx, prims);
  return canvas;
}

/** Blotchy noise used to spread the ink (R channel), plus rubber grain. */
export function renderInkNoise(size = 256): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  // value noise, 3 octaves, radial bias so ink spreads from the centre outwards
  const grid = (n: number) => {
    const g: number[] = [];
    let s = n * 7919;
    for (let i = 0; i < (n + 1) * (n + 1); i++) {
      s = (s * 16807) % 2147483647;
      g.push(s / 2147483647);
    }
    return (x: number, y: number) => {
      const fx = x * n, fy = y * n;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const at = (i: number, j: number) => g[Math.min(n, j) * (n + 1) + Math.min(n, i)];
      const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
      const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
      return a + (b - a) * sy;
    };
  };
  const o1 = grid(4), o2 = grid(11), o3 = grid(37);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const r = Math.hypot(u - 0.5, (v - 0.5) * 2.2) / 1.2;
      const n = 0.5 * o1(u, v) + 0.3 * o2(u, v) + 0.2 * o3(u, v);
      const val = Math.min(1, Math.max(0, 0.55 * n + 0.45 * r));
      const i = (y * size + x) * 4;
      img.data[i] = val * 255;
      img.data[i + 1] = o3(u, v) * 255;
      img.data[i + 2] = 0;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
