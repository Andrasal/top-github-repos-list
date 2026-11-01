/** Recipe designer — SPEC §19: hit a target ABV & finish, scale a batch, style presets. */
import { abv as abvFn } from './abv';
import { analyzeRecipe, Recipe } from './recipe';
import { yeastById } from './db';

/** OG needed to reach `targetAbv` when finishing at `fg` (Alternative equation, bisection). */
export function ogForTarget(targetAbv: number, fg: number): number {
  let lo = fg, hi = 1.3;
  if (abvFn(hi, fg) < targetAbv) return hi;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (abvFn(mid, fg) < targetAbv) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface TargetResult {
  recipe: Recipe;
  requiredOg: number;
  honeyKg: number;
  achievedAbv: number;
  notes: string[];
}

/**
 * Scale the honey (keeping varietal proportions) so the batch reaches `targetAbv`, finishing at `targetFg`.
 * A finish above the dry baseline becomes the recipe's target FG (stabilise & stop / back-sweeten).
 */
export function designForTarget(r: Recipe, targetAbv: number, targetFg: number): TargetResult {
  const notes: string[] = [];
  const yeast = yeastById(r.yeastId);
  const fg = Math.max(r.dryFg, targetFg);
  const base: Recipe = {
    ...r,
    targetFg: fg > r.dryFg + 0.0005 ? fg : null,
    honeys: r.honeys.length ? r.honeys : [{ uid: 'h-target', honeyId: 'wildflower', massKg: 1 }],
  };
  const totalHoney = base.honeys.reduce((a, h) => a + h.massKg, 0) || 1;
  const withHoney = (kg: number): Recipe => ({ ...base, honeys: base.honeys.map((h) => ({ ...h, massKg: (h.massKg / totalHoney) * kg })) });
  const reach = (kg: number) => analyzeRecipe(withHoney(kg));
  const requiredOg = ogForTarget(targetAbv, fg);
  if (reach(0.0001).effectiveOg > requiredOg) notes.push('Fruit and sugar alone already exceed this target, so no honey is needed. Lower the fruit or raise the target.');
  let lo = 0, hi = Math.max(1, base.targetVolumeL);
  while (reach(hi).effectiveOg < requiredOg && hi < 200) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (reach(mid).effectiveOg < requiredOg) lo = mid; else hi = mid;
  }
  const honeyKg = Number(((lo + hi) / 2).toFixed(3));
  const recipe = withHoney(honeyKg);
  const a = analyzeRecipe(recipe);
  if (targetAbv > yeast.tolerance) notes.push(`${yeast.name} tops out near ${yeast.tolerance} % ABV. Choose a more tolerant yeast or step-feed.`);
  if (a.primary.overVolume) notes.push('That much honey does not fit the batch volume.');
  if (fg > r.dryFg + 0.0005 && a.fg.limitedBy !== 'target') notes.push('The yeast will stop before this finish. The final gravity is set by its tolerance.');
  if (fg > r.dryFg + 0.0005) notes.push(`Ferment until the gravity reaches ${fg.toFixed(3)}, then stabilise with SO₂ and sorbate. Or ferment dry and back-sweeten.`);
  return { recipe, requiredOg, honeyKg, achievedAbv: a.abv, notes };
}

/** Scale every quantity by `factor` (volume, water, ingredients). */
export function scaleRecipe(r: Recipe, factor: number): Recipe {
  if (!(factor > 0)) return r;
  const s = (v: number) => Number((v * factor).toFixed(4));
  return {
    ...r,
    targetVolumeL: s(r.targetVolumeL),
    waterL: s(r.waterL),
    honeys: r.honeys.map((h) => ({ ...h, massKg: s(h.massKg) })),
    sugars: r.sugars.map((g) => ({ ...g, massKg: s(g.massKg) })),
    fruits: r.fruits.map((f) => ({ ...f, massKg: s(f.massKg) })),
    spices: r.spices.map((x) => ({ ...x, grams: s(x.grams) })),
    sulfite: r.sulfite.volumeOverrideL != null ? { ...r.sulfite, volumeOverrideL: s(r.sulfite.volumeOverrideL) } : r.sulfite,
  };
}
