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
import { bottles, flavourProfile, meadColor, tastingNote, ProfileInput } from './profile';
import { BatchLog, EMPTY_LOG } from './tracker';
import { Adjustment, doseForTargetPh, phModel, PhInput } from './phmodel';
import { sgToPlato } from './gravity';

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
  log: BatchLog;
  /** Alkalinity of the water used, mg/L as CaCO₃ (RO/distilled ≈ 0, soft ≈ 25–50, average tap ≈ 100, hard ≥ 200). */
  alkalinityCaCO3: number;
  /** Acid / base additions (SPEC §22). */
  adjustments: Adjustment[];
}

/** SPEC §13 — stabilisation inputs. Volume defaults to the expected recovered volume. */
export interface SulfiteSettings {
  /** Used only when `usePredictedPh` is false (a measured value). */
  pH: number;
  usePredictedPh: boolean;
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
  pH: 3.6, usePredictedPh: true, currentFreePpm: 0, currentTotalPpm: 0, targetMolecularPpm: 0.8, bindingPct: 25,
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
  log: EMPTY_LOG,
  alkalinityCaCO3: 50,
  adjustments: [],
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

  // SPEC §22 — acid–base model
  const ogSugarGPerL = sgToPlato(effectiveOg) * 10 * effectiveOg;
  const fgSugarGPerL = residualSugar(fgFinal.fg, r.dryFg);
  const phInput: PhInput = {
    primaryVolumeL: primary.volumeL,
    wholeVolumeL: whole.volumeL,
    waterL: primary.waterL,
    alkalinityCaCO3: r.alkalinityCaCO3 ?? 50,
    sugarFermentedGPerL: Math.max(0, ogSugarGPerL - fgSugarGPerL),
    honeys: r.honeys.filter((h) => h.massKg > 0).map((h) => ({ honey: honeyById(h.honeyId), massKg: h.massKg })),
    fruits: r.fruits.filter((f) => f.massKg > 0).map((f) => ({ fruit: fruitById(f.fruitId), massKg: f.massKg, stage: f.stage })),
    spices: r.spices.filter((x) => x.grams > 0).map((x) => ({ spice: spiceById(x.spiceId), grams: x.grams })),
    adjustments: (r.adjustments ?? []).filter((a) => a.grams > 0),
  };
  const ph = phModel(phInput);
  const raiseMustG = ph.mustPh < 3.0 ? doseForTargetPh(phInput, 'kBicarb', 3.3, 'must') : null;
  const lowerFinishedG = ph.finishedPh > 3.8 ? doseForTargetPh(phInput, 'tartaric', 3.6, 'finished') : null;
  // How each fruit's dose moves the finished pH (subtle → max), other ingredients held fixed
  const fruitPhCurves = r.fruits.filter((f) => f.massKg > 0).map((f) => {
    const fr = fruitById(f.fruitId);
    return {
      uid: f.uid,
      points: (['subtle', 'typical', 'bold', 'max'] as const).map((band) => {
        const kg = fr[band] * whole.volumeL;
        const p = phModel({ ...phInput, fruits: phInput.fruits.map((x) => (x.fruit.id === fr.id && x.stage === f.stage ? { ...x, massKg: kg } : x)) }, false);
        return { band, kgPerL: fr[band], mustPh: p.mustPh, finishedPh: p.finishedPh };
      }),
    };
  });

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
    acidity: { ta: ph.finishedTa, mustPh: ph.mustPh, finishedPh: ph.finishedPh, raiseMustG, lowerFinishedG },
  });

  const so = { ...DEFAULT_SULFITE, ...r.sulfite };
  const sulfitePh = so.usePredictedPh ? Number(ph.finishedPh.toFixed(2)) : so.pH;
  const sulfiteVolumeL = so.volumeOverrideL ?? occ.recoveredL + (whole.volumeL - primary.volumeL);
  const sulfite = sulfitePlan({
    volumeL: sulfiteVolumeL, pH: sulfitePh, abv, currentFreePpm: so.currentFreePpm, currentTotalPpm: so.currentTotalPpm,
    targetMolecularPpm: so.targetMolecularPpm, bindingPct: so.bindingPct, form: so.form, sorbate: so.sorbate ?? r.targetFg != null,
  });
  for (const w of sulfite.warnings) {
    if (w.severity === 'info') continue;
    flavor.advisories.unshift({ id: `so2-${w.text.slice(0, 14)}`, severity: w.severity, category: 'process', title: w.severity === 'error' ? 'Sulfite limit' : 'Sulfite', detail: w.text, source: w.source });
  }

  const profileInput: ProfileInput = {
    og: effectiveOg, fg: fgFinal.fg, abv, ta: flavor.ta, volumeL: whole.volumeL,
    honeys: r.honeys.filter((h) => h.massKg > 0).map((h) => ({ honey: honeyById(h.honeyId), massKg: h.massKg })),
    fruits: r.fruits.filter((f) => f.massKg > 0).map((f) => ({ fruit: fruitById(f.fruitId), massKg: f.massKg })),
    spices: r.spices.filter((x) => x.grams > 0).map((x) => ({ spice: spiceById(x.spiceId), grams: x.grams })),
  };
  const profile = flavourProfile(profileInput);

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
    ph,
    phInput,
    fruitPhCurves,
    profile,
    tastingNote: tastingNote(profileInput, profile),
    color: meadColor(profileInput),
    bottles: bottles(occ.recoveredL + (whole.volumeL - primary.volumeL)),
    ...flavor,
  };
}

export type Analysis = ReturnType<typeof analyzeRecipe>;
