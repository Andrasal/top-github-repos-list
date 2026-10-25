/** Fermentation model — SPEC §6. */
import { abv, fgForAbv } from './abv';
import { DRY_FG_DEFAULT, POINTS_TO_RS } from './constants';

export type Sweetness = 'dry' | 'semi-sweet' | 'sweet' | 'dessert';
export type Strength = 'sub-hydromel' | 'hydromel' | 'standard' | 'sack' | 'over-sack';

export interface FgPrediction {
  fg: number;
  abvDry: number;
  limitedBy: 'sugar' | 'yeast' | 'target';
}

/** SPEC §6.1 */
export function predictFg(og: number, toleranceAbv: number, dryFg = DRY_FG_DEFAULT, targetFg?: number | null): FgPrediction {
  const abvDry = og > dryFg ? abv(og, dryFg) : 0;
  if (targetFg != null && targetFg >= dryFg && targetFg <= og) {
    const yeastFg = abvDry > toleranceAbv ? fgForAbv(og, toleranceAbv) : dryFg;
    // A target below what the yeast can reach is unreachable — the yeast limit wins.
    if (targetFg >= yeastFg) return { fg: targetFg, abvDry, limitedBy: 'target' };
    return { fg: yeastFg, abvDry, limitedBy: 'yeast' };
  }
  if (og <= dryFg) return { fg: og, abvDry: 0, limitedBy: 'sugar' };
  if (abvDry <= toleranceAbv) return { fg: dryFg, abvDry, limitedBy: 'sugar' };
  return { fg: fgForAbv(og, toleranceAbv), abvDry, limitedBy: 'yeast' };
}

/** SPEC §6.2 */
export function sweetness(fg: number): Sweetness {
  if (fg <= 1.006) return 'dry';
  if (fg <= 1.015) return 'semi-sweet';
  if (fg <= 1.025) return 'sweet';
  return 'dessert';
}

/** SPEC §6.2 — residual sugar estimate (g/L). */
export const residualSugar = (fg: number, dryFg = DRY_FG_DEFAULT) => Math.max(0, (fg - dryFg) * 1000 * POINTS_TO_RS);

/** SPEC §6.3 — BJCP 2015 */
export function strength(abvPct: number): Strength {
  if (abvPct < 3.5) return 'sub-hydromel';
  if (abvPct < 7.5) return 'hydromel';
  if (abvPct <= 14) return 'standard';
  if (abvPct <= 18) return 'sack';
  return 'over-sack';
}

/** SPEC §6.4 */
export function sugarBreaks(og: number, fg: number) {
  return { oneThird: og - (og - fg) / 3, half: og - (og - fg) / 2, twoThirds: og - (2 * (og - fg)) / 3 };
}
