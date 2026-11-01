/**
 * ABV — Alternative Equation, STRICTLY ENFORCED — SPEC §4.
 *
 *   ABV(%) = [76.08 · (OG − FG) / (1.775 − OG)] · [FG / 0.794]
 *
 * Sources: hall-1995 (derivation), brewersfriend-abv (publication as the
 * "alternate" high-gravity formula), balling (underlying stoichiometry).
 * The linear 131.25 rule is deliberately NOT implemented as a calculator;
 * `linearAbvForComparisonOnly` exists solely for the proof panel.
 */
import { RHO_ETHANOL } from './constants';

export const ABV_CONSTANTS = { K_ABW: 76.08, OG_POLE: 1.775, RHO_ETHANOL } as const;

export class AbvDomainError extends RangeError {}

export const OG_MIN = 1.0;
export const FG_MIN = 0.98;

function assertDomain(og: number, fg: number) {
  if (!Number.isFinite(og) || !Number.isFinite(fg)) throw new AbvDomainError('OG and FG must be numbers');
  if (og < OG_MIN || og >= ABV_CONSTANTS.OG_POLE) throw new AbvDomainError(`OG must be in [1.000, 1.775): got ${og}`);
  if (fg < FG_MIN) throw new AbvDomainError(`FG must be ≥ ${FG_MIN}: got ${fg}`);
  if (fg > og) throw new AbvDomainError(`FG (${fg}) cannot exceed OG (${og})`);
}

/** Alcohol by weight (%), first bracket of the equation. */
export function abw(og: number, fg: number): number {
  assertDomain(og, fg);
  return (ABV_CONSTANTS.K_ABW * (og - fg)) / (ABV_CONSTANTS.OG_POLE - og);
}

/** Alcohol by volume (%), the only ABV function used for computed values in the app. */
export function abv(og: number, fg: number): number {
  return abw(og, fg) * (fg / ABV_CONSTANTS.RHO_ETHANOL);
}

/** Inverse: FG at which a must of `og` reaches `targetAbv` (bisection; ABV strictly decreasing in FG). */
export function fgForAbv(og: number, targetAbv: number, tol = 1e-7): number {
  assertDomain(og, og);
  if (targetAbv <= 0) return og;
  let lo = FG_MIN; // highest ABV
  let hi = og; // ABV 0
  if (abv(og, lo) < targetAbv) return lo; // unreachable target: cap at physical minimum
  while (hi - lo > tol) {
    const mid = (lo + hi) / 2;
    if (abv(og, mid) > targetAbv) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** For the citation/proof panel ONLY. Never used to compute recipe values. SPEC §4 rule 1. */
export function linearAbvForComparisonOnly(og: number, fg: number): number {
  return (og - fg) * 131.25;
}

/** Step-by-step evaluation for the "Show proof" UI. */
export function abvProof(og: number, fg: number) {
  const d = og - fg;
  const denom = ABV_CONSTANTS.OG_POLE - og;
  const abwVal = abw(og, fg);
  const densityRatio = fg / ABV_CONSTANTS.RHO_ETHANOL;
  return {
    steps: [
      { label: 'Gravity drop (OG − FG)', expr: `${og.toFixed(4)} − ${fg.toFixed(4)}`, value: d },
      { label: 'Non-linear pole (1.775 − OG)', expr: `1.775 − ${og.toFixed(4)}`, value: denom },
      { label: 'ABW = 76.08 × drop ÷ pole', expr: `76.08 × ${d.toFixed(4)} ÷ ${denom.toFixed(4)}`, value: abwVal },
      { label: 'Density ratio FG ÷ 0.794', expr: `${fg.toFixed(4)} ÷ 0.794`, value: densityRatio },
      { label: 'ABV = ABW × ratio', expr: `${abwVal.toFixed(4)} × ${densityRatio.toFixed(4)}`, value: abwVal * densityRatio },
    ],
    abv: abwVal * densityRatio,
    linearComparison: linearAbvForComparisonOnly(og, fg),
  };
}
