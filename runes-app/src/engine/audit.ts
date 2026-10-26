import { CONFLICTS, getRune } from '../data';
import type { BindruneDesign } from './bindrune';
import { WARN_RUNES } from './bindrune';
import {
  EPS,
  NEAR_MISS,
  containsSeg,
  contact,
  rotate,
  sameSeg,
  type Pt,
  type Seg,
} from './geometry';
import { armAngle, type HelmDesign } from './helm';
import { measure } from './metrics';
import { VIEW, apply, fitTransform } from './svg';

export type Status = 'pass' | 'warn' | 'fail';

export interface Check {
  id: string;
  title: string;
  status: Status;
  message: string;
  /** Indices into design.segments to highlight. */
  segs?: number[];
  points?: Pt[];
}

export interface AuditReport {
  checks: Check[];
  ok: boolean; // no failures
  symmetryOrder?: number;
}

const pass = (id: string, title: string, message: string): Check => ({ id, title, status: 'pass', message });

export function audit(design: BindruneDesign | HelmDesign): AuditReport {
  const checks = design.kind === 'bindrune' ? auditBindrune(design) : auditHelm(design);
  const report: AuditReport = { checks, ok: checks.every((c) => c.status !== 'fail') };
  if (design.kind === 'helm') report.symmetryOrder = rotationalOrder(design.segments, design.spec.count);
  return report;
}

/* ───────────────────────────── shared checks ───────────────────────────── */

function connectivity(segs: Seg[], m: ReturnType<typeof measure>): Check {
  if (m.components === 1) return pass('A3', 'Connectivity', 'All strokes form one connected figure.');
  const sizes = new Map<number, number[]>();
  m.componentOf.forEach((r, i) => sizes.set(r, [...(sizes.get(r) ?? []), i]));
  const main = [...sizes.values()].sort((a, b) => b.length - a.length)[0];
  const floating = segs.map((_, i) => i).filter((i) => !main.includes(i));
  return {
    id: 'A3', title: 'Connectivity', status: 'fail', segs: floating,
    message: `${m.components} separate pieces. ${floating.length} stroke(s) float free of the main figure.`,
  };
}

function nearMiss(m: ReturnType<typeof measure>): Check {
  if (m.nearMisses.length === 0) return pass('A4', 'Near misses', 'No strokes stop just short of another stroke.');
  return {
    id: 'A4', title: 'Near misses', status: 'fail',
    segs: [...new Set(m.nearMisses.flatMap((n) => [n.i, n.j]))],
    points: m.nearMisses.map((n) => n.p),
    message: `${m.nearMisses.length} endpoint(s) stop ${fmt(Math.min(...m.nearMisses.map((n) => n.d)))}–${fmt(Math.max(...m.nearMisses.map((n) => n.d)))} short of another stroke. When carved they read as a smudge, not a joint.`,
  };
}

function shallow(m: ReturnType<typeof measure>): Check {
  if (m.shallow.length === 0) return pass('A5', 'Crossing angles', `All crossings are at ≥ 15°.`);
  return {
    id: 'A5', title: 'Crossing angles', status: 'warn',
    segs: [...new Set(m.shallow.flatMap((c) => [c.i, c.j]))],
    points: m.shallow.map((c) => c.p),
    message: `${m.shallow.length} stroke pair(s) meet at under 15° (min ${m.shallow.reduce((a, c) => Math.min(a, c.angle), 90).toFixed(1)}°) and will blur together.`,
  };
}

function crowding(m: ReturnType<typeof measure>): Check {
  if (m.nearParallel.length === 0) return pass('A6', 'Spacing', 'No crowded parallel strokes.');
  return {
    id: 'A6', title: 'Spacing', status: 'warn',
    segs: [...new Set(m.nearParallel.flatMap((c) => [c.i, c.j]))],
    message: `${m.nearParallel.length} pair(s) of near-parallel strokes run closer than 5 % of the height.`,
  };
}

function bounds(segs: Seg[], kind: 'bindrune' | 'helm'): Check {
  const f = fitTransform(segs, kind);
  const lo = VIEW * 0.06;
  const hi = VIEW - lo;
  const bad: number[] = [];
  segs.forEach((s, i) => {
    for (const p of [apply(s.a, f), apply(s.b, f)]) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < lo || p.x > hi || p.y < lo || p.y > hi) bad.push(i);
    }
  });
  if (bad.length === 0) return pass('A11', 'Bounds & margin', 'The figure sits inside the canvas with at least a 6 % margin.');
  return { id: 'A11', title: 'Bounds & margin', status: 'fail', segs: [...new Set(bad)], message: `${bad.length} point(s) fall outside the safe margin.` };
}

function semantic(chars: string[]): Check {
  const hits: string[] = [];
  for (const c of CONFLICTS) {
    const a = chars.find((x) => c.a.includes(x));
    const b = chars.find((x) => c.b.includes(x));
    if (a && b) hits.push(`${a} + ${b}: ${c.reason}`);
  }
  if (hits.length === 0) return pass('A13', 'Semantic conflicts', 'No conflicting pairs (by modern convention).');
  return { id: 'A13', title: 'Semantic conflicts', status: 'warn', message: `Modern convention only, not historical rule. ${hits.join(' ')}` };
}

/* ───────────────────────────── bindrune ───────────────────────────── */

function auditBindrune(d: BindruneDesign): Check[] {
  const segs = d.segments;
  const m = measure(segs, d.groups);
  const checks: Check[] = [];

  // A1: one continuous stem covering y ∈ [0, 1].
  const stems = segs
    .map((s, i) => [s, i] as const)
    .filter(([s]) => Math.abs(s.a.x) <= EPS && Math.abs(s.b.x) <= EPS);
  const covers = stems.filter(([s]) => Math.min(s.a.y, s.b.y) <= EPS && Math.max(s.a.y, s.b.y) >= 1 - EPS);
  if (stems.length === 1 && covers.length === 1) {
    checks.push(pass('A1', 'Shared stem', 'The stem is one continuous stroke from top to base.'));
  } else {
    checks.push({
      id: 'A1', title: 'Shared stem', status: 'fail', segs: stems.map(([, i]) => i),
      message: `The stem is broken into ${stems.length} piece(s)${covers.length ? '' : ' and none spans the full height'}.`,
    });
  }

  // A2: every rune instance touches the stem.
  const stemIdx = covers[0]?.[1] ?? stems[0]?.[1];
  const loose: number[] = [];
  d.placements.forEach((_, inst) => {
    const own = segs.map((s, i) => [s, i] as const).filter(([s]) => s.src.includes(inst));
    const touches =
      stemIdx !== undefined &&
      own.some(([s, i]) => i === stemIdx || contact(s, segs[stemIdx]).kind !== 'none');
    if (!touches) loose.push(inst);
  });
  if (loose.length === 0) {
    checks.push(pass('A2', 'Branch attachment', 'Every rune is anchored on the shared stem.'));
  } else {
    checks.push({
      id: 'A2', title: 'Branch attachment', status: 'fail',
      segs: segs.map((s, i) => [s, i] as const).filter(([s]) => s.src.some((x) => loose.includes(x))).map(([, i]) => i),
      message: `${loose.map((i) => getRune(d.runeIds[i]).char).join(' ')} does not touch the stem.`,
    });
  }

  checks.push(connectivity(segs, m), nearMiss(m), shallow(m), crowding(m));

  // A7: partial collinear overlaps change the shape of a rune.
  if (m.partialOverlaps.length === 0) {
    checks.push(pass('A7', 'Stroke overlap', 'Shared strokes are shared exactly, so no stroke is half-absorbed.'));
  } else {
    const idx = m.partialOverlaps.map((gi) => segs.indexOf(d.groups[gi].merged)).filter((i) => i >= 0);
    checks.push({
      id: 'A7', title: 'Stroke overlap', status: 'fail', segs: idx,
      message: `${m.partialOverlaps.length} stroke(s) from different runes overlap only partly and read as one longer stroke.`,
    });
  }

  // A8: every input rune is still present in the composite.
  const missing: string[] = [];
  const missingSegs: number[] = [];
  d.expected.forEach((strokes, inst) => {
    const ok = strokes.every((e) => segs.some((s) => containsSeg(s, e, NEAR_MISS)));
    if (!ok) {
      missing.push(getRune(d.runeIds[inst]).char);
      segs.forEach((s, i) => s.src.includes(inst) && missingSegs.push(i));
    }
  });
  checks.push(
    missing.length === 0
      ? pass('A8', 'Rune recoverability', `All ${d.expected.length} rune(s) can be read back from the figure.`)
      : { id: 'A8', title: 'Rune recoverability', status: 'fail', segs: missingSegs, message: `Not recoverable: ${missing.join(' ')}.` },
  );

  checks.push(bounds(segs, 'bindrune'));

  const n = d.runeIds.length;
  checks.push(
    n > WARN_RUNES
      ? { id: 'A12', title: 'Rune count', status: 'warn', message: `${n} runes. Historical bindrunes rarely combine more than 3, so legibility suffers.` }
      : pass('A12', 'Rune count', `${n} rune(s), within the historical norm.`),
  );
  checks.push(semantic(d.runeIds.map((id) => getRune(id).char)));
  return checks;
}

/* ───────────────────────────── helm ───────────────────────────── */

/** Largest k such that rotating by 360°/k maps the figure onto itself (k divides N). */
export function rotationalOrder(segs: Seg[], n: number, tol = 1e-3): number {
  for (let m = 1; m < n; m++) {
    if (n % m !== 0) continue;
    const a = (2 * Math.PI * m) / n;
    const ok = segs.every((s) => {
      const r = { ...s, a: rotate(s.a, a), b: rotate(s.b, a) };
      return segs.some((t) => sameSeg(r, t, tol));
    });
    if (ok) return n / m;
  }
  return 1;
}

function auditHelm(d: HelmDesign): Check[] {
  const segs = d.segments;
  const n = d.spec.count;
  const m = measure(segs, []);
  const checks: Check[] = [];

  // A9: radial symmetry.
  const order = rotationalOrder(segs, n);
  const skeleton = segs.filter((s) => s.role === 'hub' || s.role === 'spoke');
  const skelOrder = rotationalOrder(skeleton, n);
  if (d.spec.symmetry === 'full') {
    // A pattern of p different arms repeats every p arms: N/p is the best possible order.
    const p = d.spec.arms.length;
    const required = n % p === 0 ? n / p : n;
    const step = (360 / required).toFixed(1);
    checks.push(
      order >= required && n % p === 0
        ? pass('A9', 'Radial symmetry', `Perfect ${order}-fold rotational symmetry (every ${step}°)${p > 1 ? `, with the ${p}-arm pattern repeating evenly` : ''}.`)
        : {
            id: 'A9', title: 'Radial symmetry', status: 'fail',
            segs: asymmetricSegs(segs, n),
            message: n % p !== 0
              ? `A ${p}-arm pattern cannot repeat evenly over ${n} arms (only ${order}-fold symmetry).`
              : `Only ${order}-fold symmetry where ${required}-fold is required.`,
          },
    );
  } else {
    checks.push(
      skelOrder === n
        ? pass('A9', 'Radial symmetry', `The skeleton (hub and spokes) has perfect ${n}-fold symmetry. The terminals differ by design, as in the manuscript (full order ${order}).`)
        : { id: 'A9', title: 'Radial symmetry', status: 'fail', segs: asymmetricSegs(skeleton, n), message: `The skeleton has only ${skelOrder}-fold symmetry.` },
    );
  }

  // A10: arm angles and hub attachment.
  const off: number[] = [];
  let worst = 0;
  segs.forEach((s, i) => {
    if (s.role !== 'spoke') return;
    const k = s.src[0];
    const expected = armAngle(k, n);
    const actual = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x);
    let delta = Math.abs(((actual - expected + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    delta = (delta * 180) / Math.PI;
    const r0 = Math.hypot(s.a.x, s.a.y);
    worst = Math.max(worst, delta);
    if (delta > 0.05 || Math.abs(r0 - d.spec.hub) > EPS) off.push(i);
  });
  checks.push(
    off.length === 0
      ? pass('A10', 'Arm placement', `All ${n} spokes leave the hub at exact ${(360 / n).toFixed(1)}° steps (max error ${worst.toFixed(3)}°).`)
      : { id: 'A10', title: 'Arm placement', status: 'fail', segs: off, message: `${off.length} spoke(s) are off-angle or detached from the hub (max error ${worst.toFixed(2)}°).` },
  );

  // A14: arms must not collide with neighbouring arms.
  const hits: number[] = [];
  const pts: Pt[] = [];
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].role === 'hub') continue;
    for (let j = i + 1; j < segs.length; j++) {
      if (segs[j].role === 'hub' || segs[i].src[0] === segs[j].src[0]) continue;
      const c = contact(segs[i], segs[j], EPS);
      if (c.kind !== 'none') {
        hits.push(i, j);
        if (c.kind !== 'collinear') pts.push(c.p);
      }
    }
  }
  checks.push(
    hits.length === 0
      ? pass('A14', 'Arm clearance', 'No arm touches its neighbours.')
      : { id: 'A14', title: 'Arm clearance', status: 'fail', segs: [...new Set(hits)], points: pts, message: `${pts.length || hits.length / 2} collision(s) between neighbouring arms.` },
  );

  checks.push(connectivity(segs, m), nearMiss(m), shallow(m), crowding(m), bounds(segs, 'helm'));
  const chars = d.spec.arms.flatMap((a) => (a.kind === 'rune' ? [getRune(a.runeId).char] : []));
  if (chars.length) checks.push(semantic(chars));
  return checks;
}

function asymmetricSegs(segs: Seg[], n: number): number[] {
  const a = (2 * Math.PI) / n;
  return segs
    .map((s, i) => [s, i] as const)
    .filter(([s]) => {
      const r = { ...s, a: rotate(s.a, a), b: rotate(s.b, a) };
      return !segs.some((t) => sameSeg(r, t, 1e-3));
    })
    .map(([, i]) => i);
}

const fmt = (x: number) => `${(x * 100).toFixed(1)} %`;

