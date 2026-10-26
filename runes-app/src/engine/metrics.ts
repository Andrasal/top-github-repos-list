import {
  CROWD_GAP,
  EPS,
  NEAR_MISS,
  PARALLEL_DEG,
  SHALLOW_DEG,
  contact,
  dist,
  dot,
  lineAngle,
  pointSegDist,
  sameSeg,
  sub,
  type MergeGroup,
  type Pt,
  type Seg,
} from './geometry';

export interface Metrics {
  crossings: { i: number; j: number; p: Pt; angle: number }[];
  shallow: { i: number; j: number; p: Pt; angle: number }[];
  nearParallel: { i: number; j: number; gap: number }[];
  nearMisses: { i: number; j: number; p: Pt; d: number }[];
  partialOverlaps: number[]; // indices of merge groups
  merged: number; // strokes saved by sharing (excluding stem)
  components: number;
  componentOf: number[];
}

/** Clutter and legibility measurements shared by the optimizer and the auditor. */
export function measure(segs: Seg[], groups: MergeGroup[]): Metrics {
  const crossings: Metrics['crossings'] = [];
  const shallow: Metrics['shallow'] = [];
  const nearParallel: Metrics['nearParallel'] = [];
  const nearMisses: Metrics['nearMisses'] = [];

  const parent = segs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i: number, j: number) => {
    parent[find(i)] = find(j);
  };

  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const c = contact(segs[i], segs[j]);
      if (c.kind !== 'none') union(i, j);
      // Neighbouring edges of one polyline (a ring, a zigzag) are its own shape, not clutter.
      if (segs[i].poly !== undefined && segs[i].poly === segs[j].poly) continue;
      if (c.kind === 'cross') {
        crossings.push({ i, j, p: c.p, angle: c.angle });
        if (c.angle < SHALLOW_DEG) shallow.push({ i, j, p: c.p, angle: c.angle });
      } else if (c.kind === 'touch' && c.angle < SHALLOW_DEG && c.angle >= 0.5) {
        shallow.push({ i, j, p: c.p, angle: c.angle });
      } else if (c.kind === 'none') {
        if (lineAngle(segs[i], segs[j]) < PARALLEL_DEG && projectionsOverlap(segs[i], segs[j])) {
          const gap = minGap(segs[i], segs[j]);
          if (gap < CROWD_GAP) nearParallel.push({ i, j, gap });
        }
      }
    }
  }

  // Near misses: an endpoint almost (but not) touching another stroke.
  const seen = new Set<string>();
  // Endpoints on the stem (bindrune) or hub (helm) are deliberate junctions.
  const anchors = segs.filter((s) => s.role === 'stem' || s.role === 'hub');
  for (let i = 0; i < segs.length; i++) {
    for (const p of [segs[i].a, segs[i].b]) {
      if (anchors.some((s) => pointSegDist(p, s).d <= EPS)) continue;
      // A collinear continuation means p is a split point inside a longer line, not a real end.
      if (segs.some((k, ki) => ki !== i && (dist(k.a, p) <= EPS || dist(k.b, p) <= EPS) && lineAngle(k, segs[i]) < 0.5)) continue;
      // Strokes passing through this endpoint (its polyline and any junction).
      const own = segs.filter((s) => pointSegDist(p, s).d <= EPS);
      for (let j = 0; j < segs.length; j++) {
        if (j === i) continue;
        if (segs[i].poly !== undefined && segs[i].poly === segs[j].poly) continue;
        // A stroke that already meets p's own polyline right next to p forms a
        // corner, not a gap (e.g. neighbouring edges of a ring).
        if (own.some((s) => meetsNear(s, segs[j], p))) continue;
        const { d } = pointSegDist(p, segs[j]);
        if (d > EPS && d <= NEAR_MISS) {
          const key = `${p.x.toFixed(3)},${p.y.toFixed(3)}:${j}`;
          if (!seen.has(key)) {
            seen.add(key);
            nearMisses.push({ i, j, p, d });
          }
        }
      }
    }
  }

  const partialOverlaps: number[] = [];
  let merged = 0;
  groups.forEach((g, gi) => {
    if (g.merged.role === 'stem') return;
    merged += g.members.length - 1;
    const sources = new Set(g.members.flatMap((m) => m.src));
    if (sources.size > 1 && !g.members.every((m) => sameSeg(m, g.merged))) partialOverlaps.push(gi);
  });

  const roots = new Set(segs.map((_, i) => find(i)));
  return {
    crossings,
    shallow,
    nearParallel,
    nearMisses,
    partialOverlaps,
    merged,
    components: roots.size,
    componentOf: segs.map((_, i) => find(i)),
  };
}

function meetsNear(s: Seg, t: Seg, p: Pt): boolean {
  const c = contact(s, t);
  return c.kind === 'touch' && dist(c.p, p) <= 2 * NEAR_MISS;
}

function projectionsOverlap(s1: Seg, s2: Seg): boolean {
  const d = sub(s1.b, s1.a);
  const L = Math.hypot(d.x, d.y);
  const u = { x: d.x / L, y: d.y / L };
  const t = (p: Pt) => dot(sub(p, s1.a), u);
  const lo = Math.min(t(s2.a), t(s2.b));
  const hi = Math.max(t(s2.a), t(s2.b));
  return Math.min(L, hi) - Math.max(0, lo) > EPS;
}

function minGap(s1: Seg, s2: Seg): number {
  return Math.min(
    pointSegDist(s1.a, s2).d,
    pointSegDist(s1.b, s2).d,
    pointSegDist(s2.a, s1).d,
    pointSegDist(s2.b, s1).d,
  );
}

/** Clutter score (spec §4.2 rule 5). Lower is better. */
export function clutterScore(m: Metrics, segs: Seg[]): number {
  let minX = 0;
  let maxX = 0;
  for (const s of segs) for (const p of [s.a, s.b]) [minX, maxX] = [Math.min(minX, p.x), Math.max(maxX, p.x)];
  const asymmetry = Math.abs(maxX + minX);
  // Hard failures (A3, A4, A7) dominate, so any passing layout beats any failing one.
  const hard = m.nearMisses.length + m.partialOverlaps.length + (m.components - 1);
  return (
    100 * hard +
    6 * m.shallow.length +
    4 * m.nearParallel.length +
    1 * m.crossings.length -
    2 * m.merged +
    3 * asymmetry
  );
}
