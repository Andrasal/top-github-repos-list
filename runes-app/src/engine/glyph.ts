import type { Rune } from '../data/types';
import { polylinesToSegs, type Seg } from './geometry';

/** How one rune is placed on the shared stem (spec §4.2 rule 2). */
export interface Placement {
  runeId: string;
  anchor: number;
  mirror: boolean;
  flip: boolean;
  /** Overlay runes only: size about the stem midpoint (1 = natural). */
  scale?: number;
}

/** Sizes tried for overlay runes (ᚷ ᛜ ᛊ …), which have no stem of their own. */
export const OVERLAY_SCALES = [1, 0.8, 1.2];

/** Transforms a rune's strokes for a placement, in the bindrune unit frame. */
export function placeRune(rune: Rune, p: Placement, src: number): Seg[] {
  const lines = rune.glyph.strokes.map((l) => {
    const out: number[] = [];
    for (let i = 0; i < l.length; i += 2) {
      let x = l[i];
      let y = l[i + 1];
      if (p.flip) y = 1 - y;
      if (p.mirror) x = -x;
      const anchor = p.mirror ? -p.anchor : p.anchor;
      const k = p.scale ?? 1;
      out.push((x - anchor) * k, 0.5 + (y - 0.5) * k);
    }
    return out;
  });
  return polylinesToSegs(lines, [src]).map((s) => (isStemLike(s) ? { ...s, role: 'stem' } : s));
}

function isStemLike(s: Seg) {
  return Math.abs(s.a.x) < 1e-9 && Math.abs(s.b.x) < 1e-9;
}

/**
 * All geometrically distinct placements for a rune. Variants that would write
 * a different rune (ᚾ↔ᛅ by mirror, ᛉ↔ᛦ by flip) are excluded.
 */
export function variants(rune: Rune): Placement[] {
  const g = rune.glyph;
  const out: Placement[] = [];
  const seen = new Set<string>();
  for (const anchor of g.anchors) {
    for (const mirror of g.noMirror ? [false] : [false, true]) {
      for (const flip of g.noFlip ? [false] : [false, true]) {
        for (const scale of g.overlay ? OVERLAY_SCALES : [1]) {
          const p: Placement = { runeId: rune.id, anchor, mirror, flip, scale };
          const key = signature(placeRune(rune, p, 0));
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(p);
        }
      }
    }
  }
  return out;
}

/** Orientation-independent geometry signature for de-duplicating variants. */
export function signature(segs: Seg[]): string {
  const r = (n: number) => (Math.round(n * 1000) / 1000 + 0).toFixed(3);
  return segs
    .map((s) => {
      const a = `${r(s.a.x)},${r(s.a.y)}`;
      const b = `${r(s.b.x)},${r(s.b.y)}`;
      return a < b ? `${a}-${b}` : `${b}-${a}`;
    })
    .sort()
    .join('|');
}
