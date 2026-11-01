/**
 * Back-sweetening solver (SPEC §27). Honey raises gravity but adds volume, which dilutes the
 * alcohol; water lowers both; spirit raises alcohol and lowers gravity. Solves honey plus
 * water or spirit together to land on a target gravity AND a target ABV.
 *
 * Mixing model: mass and alcohol volume are conserved; volumes add (ethanol–water contraction
 * when blending spirit is ignored, < 0.3 % of the spirit volume). Honey's gravity and volume
 * per kg come from the same calibrated extract as the must solver (SPEC §2.1), in the dilute
 * limit of the Lincoln equation, so both tools agree.
 */
import { RHO_HONEY_DEFAULT, RHO_WATER_20C } from './constants';
import { ogForTarget } from './designer';
import { sgToPlato } from './gravity';

/** Ethanol–water density at 20 °C vs % ethanol by WEIGHT (CRC / Perry's table), kg/L. */
const ETOH_W = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const ETOH_RHO = [0.99823, 0.98187, 0.96864, 0.95382, 0.93518, 0.91384, 0.89113, 0.86766, 0.84344, 0.81797, 0.78934];
const RHO_ETOH_PURE = 0.78934;

const lerp = (x: number, xs: number[], ys: number[]) => {
  let i = 0;
  while (i < xs.length - 2 && x > xs[i + 1]) i++;
  const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
  return ys[i] + t * (ys[i + 1] - ys[i]);
};

/** Density (kg/L, 20 °C) of a spirit or ethanol–water mix of `abvPct` % by volume. */
export function spiritDensity(abvPct: number): number {
  const target = Math.max(0, Math.min(100, abvPct));
  // ABV = ABW × ρ_mix / ρ_ethanol; find ABW by bisection (ABV rises with ABW)
  let lo = 0, hi = 100;
  for (let i = 0; i < 60; i++) {
    const w = (lo + hi) / 2;
    const v = (w * lerp(w, ETOH_W, ETOH_RHO)) / RHO_ETOH_PURE;
    if (v < target) lo = w; else hi = w;
  }
  return lerp((lo + hi) / 2, ETOH_W, ETOH_RHO);
}

/** Gravity points × litres and litres added per kg of honey (dilute limit, consistent with the must solver). */
export function honeyPerKg(densityKgL = RHO_HONEY_DEFAULT): { pkl: number; litres: number } {
  const extract = sgToPlato(densityKgL / RHO_WATER_20C) / 100;
  const pkl = (1000 * 100 * extract) / (258.6 * RHO_WATER_20C); // dSG/dP = 1/258.6 at P → 0
  return { pkl, litres: 1 / RHO_WATER_20C - pkl / 1000 };
}

export interface MeadState { volumeL: number; sg: number; abv: number }
export interface BacksweetenTarget { sg: number; abv: number }
const pts = (sg: number) => (sg - 1) * 1000;

/** Honey only: grams to reach the target gravity, and the ABV and volume that result. */
export function honeyOnly(m: MeadState, targetSg: number, honeyDensity = RHO_HONEY_DEFAULT) {
  const h = honeyPerKg(honeyDensity);
  const need = pts(targetSg) - pts(m.sg);
  const kg = Math.max(0, (need * m.volumeL) / (h.pkl - pts(targetSg) * h.litres));
  const volumeL = m.volumeL + kg * h.litres;
  return { honeyKg: kg, volumeL, abv: (m.abv * m.volumeL) / volumeL, sg: targetSg };
}

export interface BlendResult {
  ok: boolean;
  /** Second ingredient used alongside honey. */
  partner: 'water' | 'spirit' | 'none';
  honeyKg: number;
  partnerL: number;
  volumeL: number;
  sg: number;
  abv: number;
  reason?: string;
}

/**
 * Honey + water, or honey + spirit, solved together (2×2 linear system) to hit both targets.
 * Unknowns m (kg honey) and x (L partner):
 *   (P_t·v_h − PKL)·m + (P_t − p_x)·x = (P_0 − P_t)·V_0
 *   (A_t·v_h)·m      + (A_t − a_x)·x = (A_0 − A_t)·V_0
 */
export function solveBlend(m: MeadState, t: BacksweetenTarget, spiritAbv = 40, honeyDensity = RHO_HONEY_DEFAULT): BlendResult {
  const h = honeyPerKg(honeyDensity);
  const honey = honeyOnly(m, t.sg, honeyDensity);
  const partner: 'water' | 'spirit' = t.abv > honey.abv + 1e-9 ? 'spirit' : 'water';
  if (Math.abs(t.abv - honey.abv) < 0.005) return { ok: true, partner: 'none', honeyKg: honey.honeyKg, partnerL: 0, volumeL: honey.volumeL, sg: t.sg, abv: honey.abv };
  const pSpirit = partner === 'spirit' ? pts(spiritDensity(spiritAbv) / RHO_WATER_20C) : 0;
  const ax = partner === 'spirit' ? spiritAbv : 0;
  const Pt = pts(t.sg), P0 = pts(m.sg), At = t.abv, A0 = m.abv, V0 = m.volumeL;
  const a11 = Pt * h.litres - h.pkl, a12 = Pt - pSpirit, b1 = (P0 - Pt) * V0;
  const a21 = At * h.litres, a22 = At - ax, b2 = (A0 - At) * V0;
  const det = a11 * a22 - a12 * a21;
  const base = { partner, sg: t.sg, abv: t.abv } as const;
  if (Math.abs(det) < 1e-12) return { ...base, ok: false, honeyKg: 0, partnerL: 0, volumeL: V0, reason: 'These targets can’t be reached together.' };
  const kg = (b1 * a22 - a12 * b2) / det;
  const x = (a11 * b2 - b1 * a21) / det;
  const volumeL = V0 + kg * h.litres + x;
  if (kg < -1e-9 || x < -1e-9) {
    const reason = partner === 'spirit'
      ? t.abv > spiritAbv ? 'The target ABV is above the spirit’s strength.' : 'Adding spirit would pull the gravity below the target; aim for a sweeter finish or a lower ABV.'
      : 'Water lowers both gravity and ABV, so these targets need less sweetness or more alcohol.';
    return { ...base, ok: false, honeyKg: Math.max(0, kg), partnerL: Math.max(0, x), volumeL, reason };
  }
  return { ...base, ok: true, honeyKg: Math.max(0, kg), partnerL: Math.max(0, x), volumeL };
}

/**
 * Plan ahead: ferment dry at a higher OG so that, after back-sweetening with honey to the
 * target gravity, the diluted mead lands on the target ABV.
 */
export function planPrimary(volumeL: number, dryFg: number, t: BacksweetenTarget, honeyDensity = RHO_HONEY_DEFAULT) {
  const after = honeyOnly({ volumeL, sg: dryFg, abv: 0 }, t.sg, honeyDensity);
  const dilution = after.volumeL / volumeL;
  const abvBefore = t.abv * dilution;
  return { abvBefore, requiredOg: ogForTarget(abvBefore, dryFg), honeyKg: after.honeyKg, finalVolumeL: after.volumeL, dilution };
}
