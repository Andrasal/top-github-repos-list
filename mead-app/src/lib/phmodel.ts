/**
 * Recipe pH model — SPEC §22. Builds acid/cation pools from each ingredient and solves the blend.
 *  - Fruit: pool reconstructed from its measured pH + TA (FDA / Clemson pH, TA cross-checked).
 *  - Honey: gluconic acid (pKa 3.86) at its free acidity, cations back-solved from honey pH 3.9
 *    measured at 10 g/75 mL (White et al. 1962). Lactones hydrolyse in the must → finished mead uses free + lactone acidity.
 *  - Water alkalinity: strong-base equivalents (HCO₃⁻ → CO₂).
 *  - Fermentation: yeast-made succinic acid + a small cation uptake, calibrated on two published mead studies.
 */
import {
  ACIDS, AcidId, acidAddition, addPools, baseAddition, BaseId, emptyPool, Pool, poolFromJuice, scalePool, solvePh, titratableAcidity,
} from './acidbase';
import type { Fruit, Honey, Spice } from './db';
import { platoToSg } from './gravity';

const HONEY_PH_TEST_KG_PER_L = 10 / 82; // 10 g honey in 75 mL water ≈ 82 mL solution

export interface Adjustment { uid: string; id: AcidId | BaseId; grams: number; stage: 'must' | 'finished' }

export interface PhInput {
  primaryVolumeL: number;
  wholeVolumeL: number;
  waterL: number;
  alkalinityCaCO3: number; // mg/L as CaCO₃ in the water used
  sugarFermentedGPerL: number;
  honeys: { honey: Honey; massKg: number }[];
  fruits: { fruit: Fruit; massKg: number; stage: 'primary' | 'secondary' }[];
  spices: { spice: Spice; grams: number }[];
  adjustments: Adjustment[];
}

/** Fermentation acid production (SPEC §22.3), calibrated: see phmodel.test.ts. */
export const FERMENT = {
  succinicPerSugar: 0.0025, // g succinic per g sugar fermented → 0.63 g/L at 250 g/L (wine range 0.5–1.5) — fitted
  succinicMin: 0.3,
  succinicMax: 1.6,
  aceticGPerL: 0.4, // volatile acidity typical of sound wines/meads (0.3–0.6 g/L)
  cationUptakeEq: 0.0005, // eq/L of K⁺/NH₄⁺ taken up by yeast in exchange for H⁺ — fitted
  /**
   * Honey's lab pH (10 g/75 mL) overstates how it behaves in a strong must: measured honey-water musts read
   * ~0.2 lower than the ideal model predicts (activity effects). Applied to honey only, so fruit keeps its measured pH.
   */
  honeyPhShift: -0.15, // fitted
  /** Ionic strength for Davies activity correction (mol/L) — fitted; musts/wines are ~0.02–0.05. */
  ionicStrength: 0.05,
};

export function honeyPool(h: Honey, kg: number, volumeL: number, hydrolysed: boolean): Pool {
  if (volumeL <= 0 || kg <= 0) return emptyPool();
  // Back-solve honey's cations from its measured pH using free acidity only (lactones intact during the test)
  const ref = poolFromJuice('gluconic', h.ph + FERMENT.honeyPhShift, (h.freeAcidity / 1000) * HONEY_PH_TEST_KG_PER_L * ACIDS.gluconic.mw, FERMENT.ionicStrength);
  const cationsPerKg = ref.cations / HONEY_PH_TEST_KG_PER_L;
  // Total gluconate (free acid + its salts) per kg; hydrolysed lactones add free acid on top
  const acidPerKg = (ref.acids.gluconic ?? 0) / HONEY_PH_TEST_KG_PER_L + (hydrolysed ? h.lactoneAcidity / 1000 : 0);
  return { acids: { gluconic: (acidPerKg * kg) / volumeL }, cations: (cationsPerKg * kg) / volumeL };
}

export function fruitPool(f: Fruit, kg: number, volumeL: number): Pool {
  if (volumeL <= 0 || kg <= 0) return emptyPool();
  const juiceKg = kg * (1 - f.insoluble);
  const juiceL = juiceKg / (platoToSg(f.brix) * 0.9982);
  return scalePool(poolFromJuice(f.acid, f.ph, f.ta, FERMENT.ionicStrength), juiceL / volumeL);
}

const isAcid = (id: string): id is AcidId => id in ACIDS;

function adjustmentPool(a: Adjustment, volumeL: number): Pool {
  return isAcid(a.id) ? acidAddition(a.id, a.grams, volumeL) : baseAddition(a.id as BaseId, a.grams, volumeL);
}

export interface PhContribution { key: string; label: string; deltaMust: number; deltaFinished: number }

export interface PhResult {
  mustPh: number;
  finishedPh: number;
  mustTa: number;
  finishedTa: number;
  succinicGPerL: number;
  /** ±: model + data uncertainty (honey varies 3.4–6.1; activity effects ignored). */
  uncertainty: number;
  contributions: PhContribution[];
}

function pools(x: PhInput, skip?: string) {
  const Vp = x.primaryVolumeL, Vw = x.wholeVolumeL;
  const must: Pool[] = [], finishedExtra: Pool[] = [];
  x.honeys.forEach((h, i) => { if (skip !== `honey-${i}`) must.push(honeyPool(h.honey, h.massKg, Vp, false)); });
  x.fruits.forEach((f, i) => {
    if (skip === `fruit-${i}`) return;
    (f.stage === 'primary' ? must : finishedExtra).push(fruitPool(f.fruit, f.massKg, f.stage === 'primary' ? Vp : Vw));
  });
  if (skip !== 'water' && Vp > 0) must.push({ acids: {}, cations: ((x.alkalinityCaCO3 / 50) / 1000) * (x.waterL / Vp) });
  x.adjustments.forEach((a, i) => {
    if (skip === `adj-${i}`) return;
    (a.stage === 'must' ? must : finishedExtra).push(adjustmentPool(a, a.stage === 'must' ? Vp : Vw));
  });
  x.spices.forEach(({ spice, grams }, i) => {
    if (skip === `spice-${i}` || !spice.acidPerG || Vw <= 0) return;
    // acidPerG is g/L TA (tartaric eq.) per g/L of botanical → free citric acid equivalents
    const eq = (spice.acidPerG * (grams / Vw)) / 75.04;
    finishedExtra.push({ acids: { citric: eq / 3 }, cations: 0 });
  });
  return { must, finishedExtra };
}

function solve(x: PhInput, skip?: string) {
  const { must, finishedExtra } = pools(x, skip);
  const mustPool = addPools(...must);
  const Vp = x.primaryVolumeL, Vw = x.wholeVolumeL;
  // In the finished mead, honey lactones have hydrolysed and yeast have made succinic acid
  const lactone = addPools(...x.honeys.map((h, i) => (skip === `honey-${i}` ? emptyPool() : {
    acids: { gluconic: (h.honey.lactoneAcidity / 1000) * h.massKg / Math.max(Vp, 1e-9) }, cations: 0,
  })));
  const succinic = Math.min(FERMENT.succinicMax, Math.max(FERMENT.succinicMin, FERMENT.succinicPerSugar * x.sugarFermentedGPerL));
  const ferment: Pool = {
    acids: { succinic: succinic / ACIDS.succinic.mw, acetic: FERMENT.aceticGPerL / ACIDS.acetic.mw },
    cations: -Math.min(FERMENT.cationUptakeEq, mustPool.cations * 0.5),
  };
  const finishedPrimary = addPools(mustPool, lactone, ferment);
  const finished = addPools(scalePool(finishedPrimary, Vw > 0 ? Vp / Vw : 1), ...finishedExtra);
  return { mustPool, finished, succinic };
}

export function phModel(x: PhInput, withContributions = true): PhResult {
  const base = solve(x);
  const ph = (p: Pool) => solvePh(p, FERMENT.ionicStrength);
  const mustPh = ph(base.mustPool);
  const finishedPh = ph(base.finished);
  const keys: { key: string; label: string }[] = [
    ...x.honeys.map((h, i) => ({ key: `honey-${i}`, label: `${h.honey.name} honey` })),
    ...x.fruits.map((f, i) => ({ key: `fruit-${i}`, label: `${f.fruit.name}${f.stage === 'secondary' ? ' (secondary)' : ''}` })),
    ...(x.alkalinityCaCO3 > 0 ? [{ key: 'water', label: `Water alkalinity (${x.alkalinityCaCO3} mg/L CaCO₃)` }] : []),
    ...x.spices.map((s, i) => ({ key: `spice-${i}`, label: s.spice.name, acid: s.spice.acidPerG })).filter((s) => s.acid).map(({ key, label }) => ({ key, label })),
    ...x.adjustments.map((a, i) => ({ key: `adj-${i}`, label: `${a.grams} g ${a.id} (${a.stage})` })),
  ];
  const contributions = !withContributions ? [] : keys.map(({ key, label }) => {
    const w = solve(x, key);
    return { key, label, deltaMust: mustPh - ph(w.mustPool), deltaFinished: finishedPh - ph(w.finished) };
  });
  return {
    mustPh, finishedPh,
    mustTa: titratableAcidity(base.mustPool),
    finishedTa: titratableAcidity(base.finished),
    succinicGPerL: base.succinic,
    uncertainty: 0.2,
    contributions,
  };
}

/** Grams of an acid or base needed to bring the must or finished mead to `targetPh`. Bisection on dose. */
export function doseForTargetPh(x: PhInput, id: AcidId | BaseId, targetPh: number, stage: 'must' | 'finished' = 'finished', maxGPerL = 10): number | null {
  const at = (g: number) => {
    const r = phModel({ ...x, adjustments: [...x.adjustments, { uid: 'probe', id, grams: g, stage }] }, false);
    return stage === 'must' ? r.mustPh : r.finishedPh;
  };
  const now = at(0);
  const lowers = isAcid(id);
  if (lowers ? now <= targetPh : now >= targetPh) return 0;
  let lo = 0, hi = maxGPerL * (stage === 'must' ? x.primaryVolumeL : x.wholeVolumeL);
  if (lowers ? at(hi) > targetPh : at(hi) < targetPh) return null;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (lowers ? at(mid) > targetPh : at(mid) < targetPh) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
