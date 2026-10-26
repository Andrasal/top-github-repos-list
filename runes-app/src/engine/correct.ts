import { getRune } from '../data';
import { assemble, composeBindrune, withSegments, type BindruneDesign } from './bindrune';
import { audit, type AuditReport } from './audit';
import { EPS, NEAR_MISS, dist, pointSegDist, rng, type Pt, type Seg } from './geometry';
import { variants, type Placement } from './glyph';
import { ALLOWED_COUNTS, buildHelm, type HelmDesign, type HelmSpec } from './helm';

export interface Verified<D> {
  design: D;
  report: AuditReport;
  initial: AuditReport;
  log: string[];
  passes: number;
  /** True only when the final report has no failures. */
  valid: boolean;
}

const MAX_PASSES = 3;

/* ───────────────────────────── bindrune ───────────────────────────── */

/**
 * Spec §5.1 auto-correction for bindrunes:
 *  1. snap near-stem endpoints onto x = 0, cluster near-coincident endpoints,
 *     project near-miss endpoints onto the stroke they almost touch;
 *  2. re-merge collinear strokes;
 *  3. if failures persist, re-run the layout search for the best arrangement
 *     that passes the audit (the "next-best layout").
 */
export function verifyBindrune(design: BindruneDesign): Verified<BindruneDesign> {
  const initial = audit(design);
  const done = (d: BindruneDesign, report: AuditReport, log: string[], passes: number): Verified<BindruneDesign> => ({
    design: d, report, initial, log, passes, valid: report.ok,
  });
  if (initial.ok) return done(design, initial, ['Pass 0: every check passed. No correction needed.'], 0);

  const log: string[] = [];
  const failing = (r: AuditReport) => r.checks.filter((c) => c.status === 'fail').map((c) => c.id).join(', ');
  const ideal: BindruneDesign = { ...assemble(design.placements), searched: design.searched, strategy: design.strategy };
  const drifted = signatureOf(ideal.segments) !== signatureOf(design.segments);

  if (drifted) {
    // Pass 1: the layout is fine but the coordinates drifted, so repair in place.
    log.push(`Pass 1: failing ${failing(initial)}. Coordinates have drifted from the rune definitions.`);
    const { segs, moved } = snapBindrune(design.segments);
    const snapped = withSegments(design, segs);
    const r = audit(snapped);
    if (moved > 0 && r.ok) {
      log.push(`  Snapped ${moved} endpoint(s) onto the stem or the strokes they nearly touched, and re-merged shared strokes.`);
      return done(snapped, r, log, 1);
    }
    const ir = audit(ideal);
    if (ir.ok) {
      log.push('  Snapping alone was not enough, so I regenerated exact coordinates from the rune definitions.');
      return done(ideal, ir, log, 1);
    }
    log.push(`  Regenerated exact coordinates, but the layout itself fails (${failing(ir)}).`);
  } else {
    log.push(`Pass 1: failing ${failing(initial)}. The layout itself is at fault, not drift.`);
  }

  // Pass 2: compare the best layouts, each as drawn and with gaps snapped into joints.
  log.push('Pass 2: comparing the best layouts, each as drawn and with near-gaps closed into joints.');
  const best = bestValidLayout(design.runeIds, design.placements);
  if (best) {
    log.push(
      best.snapped
        ? '  No layout is clean as drawn. I picked the one where closing hair-line gaps into joints leaves the fewest blurred strokes; every rune is still readable (A8).'
        : '  I found a clean arrangement and switched to it (next-best layout).',
    );
    return done(best.design, audit(best.design), log, 2);
  }
  log.push('  No arrangement of these runes passes every check. I am showing the least cluttered attempt, which is marked invalid.');
  return done(ideal, audit(ideal), log, 2);
}

function signatureOf(segs: Seg[]): string {
  return segs
    .map((s) => [s.a.x, s.a.y, s.b.x, s.b.y].map((n) => n.toFixed(4)).join(','))
    .sort()
    .join('|');
}

/** Endpoint snapping for bindrune repair. */
export function snapBindrune(input: Seg[]): { segs: Seg[]; moved: number } {
  const segs = input.map((s) => ({ ...s, a: { ...s.a }, b: { ...s.b } }));
  let moved = 0;
  const ends: Pt[] = segs.flatMap((s) => [s.a, s.b]);

  // 1. Stem: anything within NEAR_MISS of x = 0 (inside the stem's height) goes onto it.
  for (const p of ends) {
    if (Math.abs(p.x) > EPS && Math.abs(p.x) <= NEAR_MISS && p.y >= -NEAR_MISS && p.y <= 1 + NEAR_MISS) {
      p.x = 0;
      moved++;
    }
    if (p.x === 0 && (p.y < 0 || p.y > 1) && p.y >= -NEAR_MISS && p.y <= 1 + NEAR_MISS) {
      p.y = Math.min(1, Math.max(0, p.y));
      moved++;
    }
  }

  // 2. Cluster endpoints closer than NEAR_MISS into their centroid (stem stays at x = 0).
  const parent = ends.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const d = dist(ends[i], ends[j]);
      if (d > 1e-9 && d <= NEAR_MISS) parent[find(i)] = find(j);
    }
  }
  const clusters = new Map<number, Pt[]>();
  ends.forEach((p, i) => clusters.set(find(i), [...(clusters.get(find(i)) ?? []), p]));
  for (const c of clusters.values()) {
    if (c.length < 2) continue;
    const onStem = c.some((p) => p.x === 0);
    const cx = onStem ? 0 : c.reduce((a, p) => a + p.x, 0) / c.length;
    const cy = c.reduce((a, p) => a + p.y, 0) / c.length;
    for (const p of c) {
      if (p.x !== cx || p.y !== cy) moved++;
      p.x = cx;
      p.y = cy;
    }
  }

  // 3. Project remaining near-miss endpoints onto the stroke they almost touch.
  segs.forEach((s, i) => {
    for (const p of [s.a, s.b]) {
      segs.forEach((t, j) => {
        if (i === j) return;
        const { d, q } = pointSegDist(p, t);
        if (d > EPS && d <= NEAR_MISS) {
          p.x = q.x;
          p.y = q.y;
          moved++;
        }
      });
    }
  });
  return { segs, moved };
}

/**
 * Takes the top layouts by clutter score and returns the cleanest one that
 * passes: either as drawn, or with near-gaps snapped into joints. Cleanest
 * means the fewest soft warnings (shallow crossings, crowding), then the score.
 */
function bestValidLayout(runeIds: string[], current: Placement[]): { design: BindruneDesign; snapped: boolean } | null {
  const options = runeIds.map((id) => variants(getRune(id)));
  const space = options.reduce((n, o) => n * o.length, 1);
  const candidates: BindruneDesign[] = [];
  if (space <= 5000) {
    const idx = new Array(options.length).fill(0);
    for (let n = 0; n < space; n++) {
      candidates.push({ ...assemble(idx.map((k, i) => options[i][k])), searched: space, strategy: 'brute-force' });
      for (let i = 0; i < idx.length; i++) {
        if (++idx[i] < options[i].length) break;
        idx[i] = 0;
      }
    }
  } else {
    // Single-rune changes around the current layout.
    for (let i = 0; i < options.length; i++) {
      for (const p of options[i]) {
        const trial = [...current];
        trial[i] = p;
        candidates.push({ ...assemble(trial), searched: 0, strategy: 'greedy' });
      }
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  const soft = (d: BindruneDesign) => d.metrics.shallow.length + d.metrics.nearParallel.length;
  let best: { design: BindruneDesign; snapped: boolean } | null = null;
  for (const c of candidates.slice(0, 24)) {
    let option: { design: BindruneDesign; snapped: boolean } | null = null;
    if (audit(c).ok) option = { design: c, snapped: false };
    else {
      const s = withSegments(c, snapBindrune(c.segments).segs);
      if (audit(s).ok) option = { design: s, snapped: true };
    }
    if (!option) continue;
    const key = (o: typeof option) => [soft(o.design), o.snapped ? 1 : 0, o.design.score];
    if (!best || lexLess(key(option), key(best))) best = option;
  }
  return best;
}

function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/* ───────────────────────────── helm ───────────────────────────── */

/**
 * Spec §5.1 auto-correction for helms: enforce a pattern length that divides N,
 * rebuild every arm by exact rotation (repairs drift, A9/A10), and narrow the
 * arm ornaments or widen the hub until neighbouring arms clear (A14).
 */
export function verifyHelm(design: HelmDesign): Verified<HelmDesign> {
  const log: string[] = [];
  const initial = audit(design);
  let d = design;
  let report = initial;
  let passes = 0;
  let spec: HelmSpec = { ...design.spec };

  while (!report.ok && passes < MAX_PASSES) {
    passes++;
    const failing = report.checks.filter((c) => c.status === 'fail').map((c) => c.id);
    log.push(`Pass ${passes}: failing ${failing.join(', ')}.`);

    if (failing.includes('A9') && spec.symmetry === 'full' && spec.count % spec.arms.length !== 0) {
      const p = spec.arms.length;
      const next = ALLOWED_COUNTS.find((c) => c >= spec.count && c % p === 0) ?? p * Math.max(1, Math.floor(16 / p));
      log.push(`  ${p} arm types cannot repeat evenly over ${spec.count} arms. Changed to ${next} arms for perfect symmetry.`);
      spec = { ...spec, count: next };
    }

    if (failing.some((id) => ['A9', 'A10', 'A3'].includes(id))) {
      log.push('  Rebuilt every arm by exact rotation of its canonical arm, which removes coordinate drift.');
    }

    if (failing.includes('A14') || failing.includes('A4')) {
      // Narrow ornaments (then widen the hub) until neighbouring arms are
      // clear by more than the near-miss distance, not merely untouched.
      const clear = (sp: HelmSpec) => {
        const r = audit(buildHelm(sp));
        return ['A14', 'A4'].every((id) => r.checks.find((c) => c.id === id)?.status === 'pass');
      };
      const before = { ...spec };
      for (let i = 0; i < 24 && !clear(spec); i++) {
        if (spec.lateral > 0.35) spec = { ...spec, lateral: +(spec.lateral * 0.9).toFixed(3) };
        else if (spec.hub < 0.42) spec = { ...spec, hub: +(spec.hub + 0.03).toFixed(3) };
        else break;
      }
      if (spec.lateral !== before.lateral || spec.hub !== before.hub) {
        log.push(`  Arms crowded each other. Narrowed arm ornaments to ${Math.round(spec.lateral * 100)} % and set the hub radius to ${spec.hub}.`);
      }
    }

    d = buildHelm(spec);
    report = audit(d);
  }
  if (passes === 0) log.push('Pass 0: every check passed. No correction needed.');
  return { design: d, report, initial, log, passes, valid: report.ok };
}

/* ───────────────────────────── stress test ───────────────────────────── */

/**
 * Jitters every endpoint by up to `amount` (normalized units). It simulates
 * coordinate drift so the Skeptic's detection and repair can be demonstrated
 * and tested.
 */
export function perturb(segs: Seg[], amount: number, seed = 7): Seg[] {
  const r = rng(seed);
  const j = () => (r() * 2 - 1) * amount;
  return segs.map((s) => ({ ...s, a: { x: s.a.x + j(), y: s.a.y + j() }, b: { x: s.b.x + j(), y: s.b.y + j() } }));
}

export function composeAndVerify(runeIds: string[]): Verified<BindruneDesign> {
  return verifyBindrune(composeBindrune(runeIds));
}
