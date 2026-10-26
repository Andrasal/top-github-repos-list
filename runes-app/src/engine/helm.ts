import { getRune } from '../data';
import { circleSegs, polylinesToSegs, pt, type Pt, type Role, type Seg } from './geometry';

/**
 * Helm geometry (spec §4.3), in a normalized frame: center (0,0), outer
 * radius 1, y down. Arm 0 points straight up; arms advance clockwise.
 */

export type Terminal =
  | 'aegis'
  | 'trident'
  | 'fork'
  | 'circle'
  | 'double-bar'
  | 'hook'
  | 'arrow'
  | 'bar-circles'
  | 'trident-bar';

export const TERMINALS: Record<Terminal, string> = {
  aegis: 'Ægishjálmur arm (two crossbars and a trident)',
  trident: 'Trident',
  fork: 'Open fork',
  circle: 'Ring terminal',
  'double-bar': 'Double crossbar',
  hook: 'Hook',
  arrow: 'Arrowhead',
  'bar-circles': 'Crossbar with rings',
  'trident-bar': 'Trident with crossbar',
};

export type ArmSpec = { kind: 'rune'; runeId: string } | { kind: 'terminal'; terminal: Terminal };

export interface HelmSpec {
  arms: ArmSpec[]; // pattern, cycled over `count`
  count: number; // N
  hub: number; // r0, hub radius
  lateral: number; // width scale for arm ornaments (1 = natural)
  /** 'full': every arm identical under rotation; 'skeleton': hub+spokes only (Vegvísir). */
  symmetry: 'full' | 'skeleton';
}

export interface HelmDesign {
  kind: 'helm';
  spec: HelmSpec;
  segments: Seg[];
  angles: number[];
  armLength: number;
}

export const ALLOWED_COUNTS = [4, 6, 8, 12, 16];

/** Arm-local polylines in (u, v): u along the ray 0 (hub) → 1 (tip), v lateral. */
function terminalLines(t: Terminal): number[][] {
  const ring = (u: number, v: number, r: number, n = 16): number[] => {
    const out: number[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (2 * Math.PI * i) / n;
      out.push(u + r * Math.cos(a), v + r * Math.sin(a));
    }
    return out;
  };
  switch (t) {
    case 'aegis':
      return [[0, 0, 1, 0], [0.3, -0.09, 0.3, 0.09], [0.48, -0.09, 0.48, 0.09], [0.7, 0, 0.94, -0.14], [0.7, 0, 0.94, 0.14]];
    case 'trident':
      return [[0, 0, 1, 0], [0.72, 0, 0.94, -0.14], [0.72, 0, 0.94, 0.14]];
    case 'trident-bar':
      return [[0, 0, 1, 0], [0.45, -0.1, 0.45, 0.1], [0.72, 0, 0.94, -0.14], [0.72, 0, 0.94, 0.14]];
    case 'fork':
      return [[0, 0, 0.75, 0], [0.75, 0, 1, -0.13], [0.75, 0, 1, 0.13]];
    case 'circle':
      return [[0, 0, 0.84, 0], ring(0.92, 0, 0.08)];
    case 'double-bar':
      return [[0, 0, 1, 0], [0.6, -0.11, 0.6, 0.11], [0.84, -0.11, 0.84, 0.11]];
    case 'hook':
      return [[0, 0, 1, 0], [1, 0, 0.86, 0.12], [0.5, -0.09, 0.5, 0.09]];
    case 'arrow':
      return [[0, 0, 1, 0], [1, 0, 0.84, -0.12], [1, 0, 0.84, 0.12]];
    case 'bar-circles':
      return [[0, 0, 1, 0], [0.62, -0.1, 0.62, 0.1], ring(0.62, -0.16, 0.06, 16), ring(0.62, 0.16, 0.06, 16)];
  }
}

/**
 * Rune unit frame (x, y) → arm frame: u = 1 − (1 − RUNE_START)·y, v = x, so the
 * rune reads from the tip. A full spoke always runs hub → tip, and replaces
 * the rune's own stem when it has one.
 */
function runeLines(runeId: string): number[][] {
  const k = 1 - RUNE_START;
  const lines = getRune(runeId).glyph.strokes
    .filter((l) => !(l.length === 4 && l[0] === 0 && l[2] === 0 && Math.abs(l[1] - l[3]) === 1))
    .map((l) => {
      const out: number[] = [];
      for (let i = 0; i < l.length; i += 2) out.push(1 - k * l[i + 1], l[i]);
      return out;
    });
  return [[0, 0, 1, 0], ...lines];
}

export function armLines(arm: ArmSpec): number[][] {
  return arm.kind === 'terminal' ? terminalLines(arm.terminal) : runeLines(arm.runeId);
}

/** Every arm shares this skeleton spoke, so skeleton symmetry holds even when terminals differ. */
export const SKELETON = 0.55;

/** Rune arms start this far out along the spoke, clear of the hub ring. */
export const RUNE_START = 0.15;

/**
 * Arm strokes with roles. The spoke runs hub → outward along v = 0 and is
 * split at SKELETON: the inner part is the shared skeleton, the rest belongs
 * to the terminal.
 */
function canonicalArm(arm: ArmSpec): [Role, number[]][] {
  const [first, ...rest] = armLines(arm);
  const u0 = Math.min(first[0], first[2]);
  const u1 = Math.max(first[0], first[2]);
  const out: [Role, number[]][] = [['spoke', [u0, 0, Math.min(u1, SKELETON), 0]]];
  if (u1 > SKELETON) out.push(['arm', [SKELETON, 0, u1, 0]]);
  for (const l of rest) out.push(['arm', l]);
  return out;
}

export function armAngle(k: number, n: number): number {
  return -Math.PI / 2 + (2 * Math.PI * k) / n;
}

/** Maps arm-local (u, v) to the helm frame for arm angle θ. */
export function armToWorld(u: number, v: number, theta: number, hub: number, lateral: number): Pt {
  const L = 1 - hub;
  const r = hub + u * L;
  const w = v * L * lateral;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return pt(r * c - w * s, r * s + w * c);
}

export function buildHelm(spec: HelmSpec): HelmDesign {
  const segments: Seg[] = [];
  const angles: number[] = [];
  for (let k = 0; k < spec.count; k++) {
    const theta = armAngle(k, spec.count);
    angles.push(theta);
    const arm = spec.arms[k % spec.arms.length];
    const world = canonicalArm(arm).map(([role, l]) => {
      const out: number[] = [];
      for (let i = 0; i < l.length; i += 2) {
        const p = armToWorld(l[i], l[i + 1], theta, spec.hub, spec.lateral);
        out.push(p.x, p.y);
      }
      return [role, out] as const;
    });
    for (const [role, line] of world) segments.push(...polylinesToSegs([line], [k], role));
  }
  // Hub: a polygon whose vertices include every arm angle, so it is exactly
  // as symmetric as the arms (spec §5 A9).
  const sides = spec.count * Math.max(1, Math.ceil(64 / spec.count));
  segments.push(...circleSegs(pt(0, 0), spec.hub, sides, -Math.PI / 2, [-1], 'hub'));
  return { kind: 'helm', spec, segments, angles, armLength: 1 - spec.hub };
}

export const PRESETS: Record<'aegishjalmur' | 'vegvisir', HelmSpec> = {
  aegishjalmur: {
    arms: [{ kind: 'terminal', terminal: 'aegis' }],
    count: 8,
    hub: 0.2,
    lateral: 1,
    symmetry: 'full',
  },
  vegvisir: {
    // Stylized after the Huld MS: eight different terminals on one skeleton.
    arms: (['trident-bar', 'fork', 'circle', 'double-bar', 'hook', 'arrow', 'bar-circles', 'trident'] as Terminal[]).map(
      (terminal) => ({ kind: 'terminal' as const, terminal }),
    ),
    count: 8,
    hub: 0.16,
    lateral: 1,
    symmetry: 'skeleton',
  },
};

export function runeHelmSpec(runeIds: string[], count: number): HelmSpec {
  return {
    arms: runeIds.map((runeId) => ({ kind: 'rune', runeId })),
    count,
    hub: 0.22,
    lateral: 1,
    symmetry: 'full',
  };
}

