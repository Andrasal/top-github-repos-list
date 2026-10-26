import { bbox, type Pt, type Seg } from './geometry';

export const VIEW = 400;
export const MARGIN = 0.1; // render margin; the auditor requires ≥ 6 % (A11)

export interface Fit {
  scale: number;
  tx: number;
  ty: number;
}

/**
 * Fits normalized geometry into the 400×400 viewBox (spec §6). The stem or
 * outer radius drives the scale so designs with different widths stay
 * comparable; wide designs shrink to keep the margin.
 */
export function fitTransform(segs: Seg[], kind: 'bindrune' | 'helm'): Fit {
  const inner = VIEW * (1 - 2 * MARGIN);
  if (kind === 'helm') {
    let r = 1;
    for (const s of segs) for (const p of [s.a, s.b]) r = Math.max(r, Math.hypot(p.x, p.y));
    const k = inner / 2 / r;
    return { scale: k, tx: VIEW / 2, ty: VIEW / 2 };
  }
  const b = bbox(segs);
  const k = Math.min(inner / Math.max(b.h, 1e-9), inner / Math.max(b.w, 1e-9), 260);
  return { scale: k, tx: VIEW / 2 - ((b.minX + b.maxX) / 2) * k, ty: VIEW / 2 - ((b.minY + b.maxY) / 2) * k };
}

export const apply = (p: Pt, f: Fit): Pt => ({ x: p.x * f.scale + f.tx, y: p.y * f.scale + f.ty });

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Serializes segments to an SVG path `d` string (coordinates rounded to 0.01). */
export function pathData(segs: Seg[], f: Fit): string {
  return segs
    .map((s) => {
      const a = apply(s.a, f);
      const b = apply(s.b, f);
      return `M${r2(a.x)} ${r2(a.y)}L${r2(b.x)} ${r2(b.y)}`;
    })
    .join('');
}

/** Standalone SVG document for export. */
export function toSvgDocument(segs: Seg[], kind: 'bindrune' | 'helm', title: string, stroke = '#2b2b2b'): string {
  const f = fitTransform(segs, kind);
  const w = kind === 'helm' ? 7 : 10;
  const esc = title.replace(/[<&>]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;' })[c]!);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" width="${VIEW}" height="${VIEW}">` +
    `<title>${esc}</title><rect width="100%" height="100%" fill="#f7f6f2"/>` +
    `<path d="${pathData(segs, f)}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`
  );
}
