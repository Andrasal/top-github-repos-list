/** Orchestrator: Recipe (SI state) → Analysis. The UI never does math. SPEC §1 data flow. */
import { abv as abvFn, abw as abwFn } from './abv';
import { DRY_FG_DEFAULT, NDemand } from './constants';
import { fruitById, honeyById, spiceById, sugarById, yeastById, SugarId } from './db';
import { predictFg, residualSugar, strength, sugarBreaks, sweetness } from './fermentation';
import { advise } from './flavor';
import {
  Component, contributions, fruitComponent, honeyComponent, honeyExtractFromDensity, occupancy, solveForTargetVolume, solveForWater, sugarComponent,
} from './must';
import { nutrientSchedule, Protocol, rehydration, yanRequirement } from './nutrients';
import { sulfitePlan, SulfiteForm } from './sulfite';

export interface Recipe {
  name: string;
  mode: 'targetVolume' | 'fixedWater';
  targetVolumeL: number;
  waterL: number;
  honeys: { uid: string; honeyId: string; massKg: number }[];
  sugars: { uid: string; sugarId: SugarId; massKg: number }[];
  fruits: { uid: string; fruitId: string; massKg: number; stage: 'primary' | 'secondary' }[];
  spices: { uid: string; spiceId: string; grams: number }[];
  yeastId: string;
  nDemandOverride: NDemand | null;
  protocol: Protocol;
  creditFruitYan: boolean;
  targetFg: number | null;
  dryFg: number;
  sulfite: SulfiteSettings;
}

/** SPEC §13 — stabilisation inputs. Volume defaults to the expected recovered volume. */
export interface SulfiteSettings {
  pH: number;
  currentFreePpm: number;
  currentTotalPpm: number;
  targetMolecularPpm: number;
  bindingPct: number;
  form: SulfiteForm;
  volumeOverrideL: number | null;
  /** null = automatic: add sorbate when back-sweetening (target FG set). */
  sorbate: boolean | null;
}

export const DEFAULT_SULFITE: SulfiteSettings = {
  pH: 3.6, currentFreePpm: 0, currentTotalPpm: 0, targetMolecularPpm: 0.8, bindingPct: 25,
  form: 'kmeta', volumeOverrideL: null, sorbate: null,
};

export const DEFAULT_RECIPE: Recipe = {
  name: 'Wildflower Blackberry Melomel',
  mode: 'targetVolume',
  targetVolumeL: 10,
  waterL: 6,
  honeys: [{ uid: 'h1', honeyId: 'wildflower', massKg: 3 }],
  sugars: [],
  fruits: [{ uid: 'f1', fruitId: 'blackberry', massKg: 2, stage: 'primary' }],
  spices: [{ uid: 's1', spiceId: 'vanilla', grams: 6 }],
  yeastId: 'k1v1116',
  nDemandOverride: null,
  protocol: 'tosna3',
  creditFruitYan: false,
  targetFg: null,
  dryFg: DRY_FG_DEFAULT,
  sulfite: DEFAULT_SULFITE,
};

function primaryComponents(r: Recipe): Component[] {
  return [
    ...r.honeys.filter((h) => h.massKg > 0).map((h) => {
      const hon = honeyById(h.honeyId);
      return honeyComponent(h.uid, `${hon.name} honey`, h.massKg, honeyExtractFromDensity(hon.density));
    }),
    ...r.sugars.filter((s) => s.massKg > 0).map((s) => {
      const sug = sugarById(s.sugarId);
      return sugarComponent(s.uid, sug.name, s.massKg, sug.purity);
    }),
    ...r.fruits.filter((f) => f.massKg > 0 && f.stage === 'primary').map((f) => fruitDef(f.uid, f.fruitId, f.massKg)),
  ];
}

function fruitDef(uid: string, fruitId: string, massKg: number) {
  const fr = fruitById(fruitId);
  return fruitComponent(uid, fr.name, massKg, fr.brix, fr.insoluble, fr.retention);
}

export function analyzeRecipe(r: Recipe) {
  const comps = primaryComponents(r);
  const primary = r.mode === 'targetVolume' ? solveForTargetVolume(comps, r.targetVolumeL) : solveForWater(comps, r.waterL);
  const og = primary.sg;
  const yeast = yeastById(r.yeastId);
  const demand = r.nDemandOverride ?? yeast.nDemand;

  // SPEC §5.6 — secondary fruit: same water, all sugar conserved → effective whole-batch OG for ABV.
  const secondaryComps = r.fruits.filter((f) => f.massKg > 0 && f.stage === 'secondary').map((f) => fruitDef(f.uid, f.fruitId, f.massKg));
  const whole = secondaryComps.length ? solveForWater([...comps, ...secondaryComps], primary.waterL) : primary;
  const effectiveOg = whole.sg;

  const fgPrimary = predictFg(og, yeast.tolerance, r.dryFg, secondaryComps.length ? null : r.targetFg);
  const fgFinal = predictFg(effectiveOg, yeast.tolerance, r.dryFg, r.targetFg);
  const abv = effectiveOg > fgFinal.fg ? abvFn(effectiveOg, fgFinal.fg) : 0;
  const abw = effectiveOg > fgFinal.fg ? abwFn(effectiveOg, fgFinal.fg) : 0;
  const breaks = sugarBreaks(og, fgPrimary.fg);

  // SPEC §7.1 fruit YAN credit (primary fruit only)
  const creditPpm = r.creditFruitYan && primary.volumeL > 0
    ? r.fruits.filter((f) => f.stage === 'primary').reduce((a, f) => {
        const fr = fruitById(f.fruitId);
        return a + f.massKg * (1 - fr.insoluble) * fr.yan;
      }, 0) / primary.volumeL
    : 0;
  const yan = yanRequirement(og, demand, creditPpm);
  const schedule = nutrientSchedule(r.protocol, yan.netPpm, primary.volumeL, breaks.oneThird);
  const rehy = rehydration(primary.volumeL, og);

  const contrib = comps.length && r.mode === 'targetVolume' ? contributions(comps, r.targetVolumeL) : comps.length ? contributions(comps, primary.volumeL) : [];
  const occ = occupancy(comps, primary);

  const flavor = advise({
    volumeL: whole.volumeL,
    og: effectiveOg,
    fg: fgFinal.fg,
    abv,
    abvDry: fgFinal.abvDry,
    toleranceAbv: yeast.tolerance,
    sweetness: sweetness(fgFinal.fg),
    honeys: r.honeys.map((h) => ({ honey: honeyById(h.honeyId), massKg: h.massKg })),
    fruits: r.fruits.filter((f) => f.massKg > 0).map((f) => ({ fruit: fruitById(f.fruitId), massKg: f.massKg, stage: f.stage })),
    spices: r.spices.filter((s) => s.grams > 0).map((s) => ({ spice: spiceById(s.spiceId), grams: s.grams })),
  });

  const so = { ...DEFAULT_SULFITE, ...r.sulfite };
  const sulfiteVolumeL = so.volumeOverrideL ?? occ.recoveredL + (whole.volumeL - primary.volumeL);
  const sulfite = sulfitePlan({
    volumeL: sulfiteVolumeL, pH: so.pH, currentFreePpm: so.currentFreePpm, currentTotalPpm: so.currentTotalPpm,
    targetMolecularPpm: so.targetMolecularPpm, bindingPct: so.bindingPct, form: so.form, sorbate: so.sorbate ?? r.targetFg != null,
  });
  for (const w of sulfite.warnings.filter((x) => x.severity === 'error')) {
    flavor.advisories.unshift({ id: `so2-${w.text.slice(0, 14)}`, severity: 'error', category: 'process', title: 'Sulfite limit', detail: w.text, source: w.source });
  }

  if (primary.overVolume) {
    flavor.advisories.unshift({
      id: 'over-volume', severity: 'error', category: 'process', title: 'Ingredients exceed the target volume',
      detail: `Honey, sugar and fruit juice alone make ${primary.volumeL.toFixed(2)} L — more than the ${r.targetVolumeL} L target, before any water.`,
      suggestion: 'Increase the batch volume or reduce fermentables.', source: ['practice'],
    });
  }
  for (const w of schedule.warnings) {
    flavor.advisories.unshift({ id: `nutrient-${w.text.slice(0, 12)}`, severity: w.severity, category: 'process', title: 'Nutrient guard rail', detail: w.text, source: ['tosna', 'scott-handbook', 'ttb-24-246'] });
  }

  return {
    recipe: r,
    yeast,
    demand,
    primary,
    whole,
    og,
    effectiveOg,
    hasSecondaryFruit: secondaryComps.length > 0,
    fg: fgFinal,
    fgPrimary,
    abv,
    abw,
    sweetness: sweetness(fgFinal.fg),
    residualSugarGPerL: residualSugar(fgFinal.fg, r.dryFg),
    strength: strength(abv),
    breaks,
    yan,
    schedule,
    rehydration: rehy,
    contributions: contrib,
    occupancy: occ,
    sulfite,
    ...flavor,
  };
}

export type Analysis = ReturnType<typeof analyzeRecipe>;
