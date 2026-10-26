/** Core 2D geometry for the drawing and audit engines. */

export interface Pt {
  x: number;
  y: number;
}

export type Role = 'stem' | 'branch' | 'hub' | 'spoke' | 'arm';

export interface Seg {
  a: Pt;
  b: Pt;
  /** Rune-instance (bindrune) or arm (helm) indices that contributed this stroke. */
  src: number[];
  role: Role;
  /** Polyline this stroke came from; edges of one polyline are not near-missed against each other. */
  poly?: number;
}

let polyCounter = 0;

/** Tolerances in normalized units (stem height = 1, helm radius = 1). Spec §5. */
export const EPS = 0.004;
export const NEAR_MISS = 0.035;
export const SHALLOW_DEG = 15;
export const PARALLEL_DEG = 6;
export const CROWD_GAP = 0.05;

export const pt = (x: number, y: number): Pt => ({ x, y });
export const sub = (p: Pt, q: Pt): Pt => ({ x: p.x - q.x, y: p.y - q.y });
export const add = (p: Pt, q: Pt): Pt => ({ x: p.x + q.x, y: p.y + q.y });
export const scale = (p: Pt, k: number): Pt => ({ x: p.x * k, y: p.y * k });
export const dot = (p: Pt, q: Pt) => p.x * q.x + p.y * q.y;
export const cross = (p: Pt, q: Pt) => p.x * q.y - p.y * q.x;
export const dist = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);
export const segLen = (s: Seg) => dist(s.a, s.b);

export function seg(ax: number, ay: number, bx: number, by: number, src: number[] = [], role: Role = 'branch'): Seg {
  return { a: pt(ax, ay), b: pt(bx, by), src, role };
}

/** Converts polylines [x0,y0,x1,y1,…] to segments. */
export function polylinesToSegs(lines: number[][], src: number[] = [], role: Role = 'branch'): Seg[] {
  const out: Seg[] = [];
  for (const l of lines) {
    const poly = ++polyCounter;
    for (let i = 0; i + 3 < l.length; i += 2) out.push({ ...seg(l[i], l[i + 1], l[i + 2], l[i + 3], src, role), poly });
  }
  return out;
}

export function rotate(p: Pt, angle: number, c: Pt = pt(0, 0)): Pt {
  const s = Math.sin(angle);
  const k = Math.cos(angle);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * k - dy * s, y: c.y + dx * s + dy * k };
}

/** Distance from p to segment s, plus the clamped parameter t ∈ [0,1]. */
export function pointSegDist(p: Pt, s: Seg): { d: number; t: number; q: Pt } {
  const v = sub(s.b, s.a);
  const L2 = dot(v, v);
  let t = L2 === 0 ? 0 : dot(sub(p, s.a), v) / L2;
  t = Math.max(0, Math.min(1, t));
  const q = add(s.a, scale(v, t));
  return { d: dist(p, q), t, q };
}

/** Acute angle in degrees between the lines carrying two segments (0…90). */
export function lineAngle(s1: Seg, s2: Seg): number {
  const v1 = sub(s1.b, s1.a);
  const v2 = sub(s2.b, s2.a);
  const c = Math.abs(dot(v1, v2)) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
  return (Math.acos(Math.min(1, c)) * 180) / Math.PI;
}

export type Contact =
  | { kind: 'none' }
  | { kind: 'cross'; p: Pt; angle: number } // interiors cross
  | { kind: 'touch'; p: Pt; angle: number } // endpoint on the other segment
  | { kind: 'collinear' };

/** Classifies how two segments meet, with tolerance eps. */
export function contact(s1: Seg, s2: Seg, eps = EPS): Contact {
  const angle = lineAngle(s1, s2);
  if (angle < 0.5 && isCollinear(s1, s2, eps)) {
    const ov = collinearOverlap(s1, s2);
    return ov > -eps ? { kind: 'collinear' } : { kind: 'none' };
  }
  // Endpoint touches.
  for (const [p, other] of [[s1.a, s2], [s1.b, s2], [s2.a, s1], [s2.b, s1]] as [Pt, Seg][]) {
    if (pointSegDist(p, other).d <= eps) return { kind: 'touch', p, angle };
  }
  const r = sub(s1.b, s1.a);
  const s = sub(s2.b, s2.a);
  const den = cross(r, s);
  if (Math.abs(den) < 1e-12) return { kind: 'none' };
  const qp = sub(s2.a, s1.a);
  const t = cross(qp, s) / den;
  const u = cross(qp, r) / den;
  if (t > 0 && t < 1 && u > 0 && u < 1) return { kind: 'cross', p: add(s1.a, scale(r, t)), angle };
  return { kind: 'none' };
}

/** Both segments lie on the same infinite line (within eps). */
export function isCollinear(s1: Seg, s2: Seg, eps = EPS): boolean {
  const L = segLen(s1);
  if (L < 1e-9) return false;
  const lineDist = (p: Pt) => Math.abs(cross(sub(s1.b, s1.a), sub(p, s1.a))) / L;
  return lineDist(s2.a) <= eps && lineDist(s2.b) <= eps;
}

/** Signed overlap length of two collinear segments (negative = gap). */
export function collinearOverlap(s1: Seg, s2: Seg): number {
  const d = sub(s1.b, s1.a);
  const L = Math.hypot(d.x, d.y);
  const u = { x: d.x / L, y: d.y / L };
  const p = (q: Pt) => dot(sub(q, s1.a), u);
  const [a0, a1] = [0, L];
  const [b0, b1] = [Math.min(p(s2.a), p(s2.b)), Math.max(p(s2.a), p(s2.b))];
  return Math.min(a1, b1) - Math.max(a0, b0);
}

export function sameSeg(s1: Seg, s2: Seg, eps = EPS): boolean {
  return (
    (dist(s1.a, s2.a) <= eps && dist(s1.b, s2.b) <= eps) || (dist(s1.a, s2.b) <= eps && dist(s1.b, s2.a) <= eps)
  );
}

/** True if `inner` lies on `outer` (collinear and contained). */
export function containsSeg(outer: Seg, inner: Seg, eps = EPS): boolean {
  return pointSegDist(inner.a, outer).d <= eps && pointSegDist(inner.b, outer).d <= eps;
}

export interface MergeGroup {
  merged: Seg;
  members: Seg[];
}

/**
 * Merges collinear strokes that overlap or touch end-to-end into single
 * strokes (spec §4.2 rule 1 & 3). Returns the groups so the auditor can tell
 * identical sharing (good) from partial overlap (A7).
 */
export function mergeCollinear(segs: Seg[], eps = EPS): MergeGroup[] {
  const groups: MergeGroup[] = [];
  const used = new Array(segs.length).fill(false);
  for (let i = 0; i < segs.length; i++) {
    if (used[i] || segLen(segs[i]) < eps) {
      used[i] = true;
      continue;
    }
    used[i] = true;
    const members = [segs[i]];
    let changed = true;
    let cur = segs[i];
    while (changed) {
      changed = false;
      for (let j = 0; j < segs.length; j++) {
        if (used[j]) continue;
        if (lineAngle(cur, segs[j]) < 0.5 && isCollinear(cur, segs[j], eps) && collinearOverlap(cur, segs[j]) >= -eps) {
          used[j] = true;
          members.push(segs[j]);
          cur = spanOf(members, cur);
          changed = true;
        }
      }
    }
    const src = [...new Set(members.flatMap((m) => m.src))].sort((a, b) => a - b);
    const role = members.some((m) => m.role === 'stem') ? 'stem' : members[0].role;
    groups.push({ merged: { ...cur, src, role }, members });
  }
  return groups;
}

/** Smallest segment along `ref`'s line that covers all members. */
function spanOf(members: Seg[], ref: Seg): Seg {
  const d = sub(ref.b, ref.a);
  const L = Math.hypot(d.x, d.y);
  const u = { x: d.x / L, y: d.y / L };
  let lo = Infinity;
  let hi = -Infinity;
  let pLo = ref.a;
  let pHi = ref.b;
  for (const m of members) {
    for (const p of [m.a, m.b]) {
      const t = dot(sub(p, ref.a), u);
      if (t < lo) [lo, pLo] = [t, p];
      if (t > hi) [hi, pHi] = [t, p];
    }
  }
  return { a: { ...pLo }, b: { ...pHi }, src: ref.src, role: ref.role };
}

export function bbox(segs: Seg[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of segs) {
    for (const p of [s.a, s.b]) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Regular polygon approximating a circle (spec §3: auditor sees segments only). */
export function circleSegs(c: Pt, r: number, n: number, startAngle: number, src: number[], role: Role): Seg[] {
  const out: Seg[] = [];
  const poly = ++polyCounter;
  for (let i = 0; i < n; i++) {
    const t0 = startAngle + (2 * Math.PI * i) / n;
    const t1 = startAngle + (2 * Math.PI * (i + 1)) / n;
    out.push({
      a: pt(c.x + r * Math.cos(t0), c.y + r * Math.sin(t0)),
      b: pt(c.x + r * Math.cos(t1), c.y + r * Math.sin(t1)),
      src,
      role,
      poly,
    });
  }
  return out;
}

/** Deterministic PRNG (mulberry32) for reproducible perturbation tests. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
