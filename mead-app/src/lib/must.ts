/**
 * Must solver — SPEC §5. Mass-balance model: dissolved solids in water.
 * Volumes are DERIVED from density (Lincoln eq.), never summed — sugar solutions are not volume-additive.
 */
import {
  RHO_WATER_20C,
  RHO_FRUIT_WHOLE,
  RHO_FRUIT_INSOLUBLE,
  RHO_SUCROSE_SOLID,
  HEADSPACE_FRUIT,
  HEADSPACE_TRADITIONAL,
  LEES_LOSS_FRACTION,
  FRUIT_RETENTION_DEFAULT,
} from './constants';
import { platoToSg, points, sgToPlato } from './gravity';
import { PPG_PER_PKL } from './units';

/** A normalised fermentable: what it puts into solution. SPEC §5.1 */
export interface Component {
  key: string;
  label: string;
  /** Total mass that enters the LIQUID phase (kg). */
  liquidKg: number;
  /** Dissolved solids (sugar) mass (kg). */
  solidsKg: number;
  /** Insoluble mass that stays as pulp (kg). */
  insolubleKg: number;
  /** Mass as weighed by the user (kg) — for PKL/PPG normalisation. */
  inputKg: number;
  kind: 'honey' | 'sugar' | 'fruit';
  /** Fruit only: L of liquid retained in pulp per kg at racking. */
  retentionLPerKg?: number;
}

/**
 * SPEC §2.1/§5.1 — honey's sucrose-equivalent extract, calibrated from its MEASURED density.
 * Treating refractometer solids (~82 %) as sucrose would predict ρ ≈ 1.44 kg/L, but honey measures ≈ 1.42;
 * solving the Lincoln equation for ρ = 1.42 gives E ≈ 0.797, which reproduces the empirical ~35–37 PPG.
 */
export const honeyExtractFromDensity = (densityKgL: number) => sgToPlato(densityKgL / RHO_WATER_20C) / 100;

export const honeyComponent = (key: string, label: string, massKg: number, extract: number): Component => ({
  key, label, kind: 'honey', inputKg: massKg, liquidKg: massKg, solidsKg: massKg * extract, insolubleKg: 0,
});

export const sugarComponent = (key: string, label: string, massKg: number, purity: number): Component => ({
  key, label, kind: 'sugar', inputKg: massKg, liquidKg: massKg, solidsKg: massKg * purity, insolubleKg: 0,
});

/** SPEC §5.1 fruit row: soluble = m(1−i); sugar = m(1−i)·B/100; insoluble = m·i. */
export function fruitComponent(
  key: string, label: string, massKg: number, brix: number, insoluble: number, retention = FRUIT_RETENTION_DEFAULT,
): Component {
  const soluble = massKg * (1 - insoluble);
  return {
    key, label, kind: 'fruit', inputKg: massKg, liquidKg: soluble, solidsKg: (soluble * brix) / 100,
    insolubleKg: massKg * insoluble, retentionLPerKg: retention,
  };
}

export interface SolutionState {
  massKg: number;
  solidsKg: number;
  plato: number;
  sg: number;
  volumeL: number;
}

/** Solution properties for given components + water mass. SPEC §5.2 */
export function solutionState(components: Component[], waterKg: number): SolutionState {
  const massKg = components.reduce((a, c) => a + c.liquidKg, 0) + waterKg;
  const solidsKg = components.reduce((a, c) => a + c.solidsKg, 0);
  if (massKg <= 0) return { massKg: 0, solidsKg: 0, plato: 0, sg: 1, volumeL: 0 };
  const plato = (100 * solidsKg) / massKg;
  if (plato > 85) {
    // Beyond the solubility/Lincoln range (e.g. dry sugar, zero water): treat undissolved solids as a solid phase.
    const volumeL = solidsKg / RHO_SUCROSE_SOLID + (massKg - solidsKg) / RHO_WATER_20C;
    return { massKg, solidsKg, plato, sg: massKg / volumeL / RHO_WATER_20C, volumeL };
  }
  const sg = platoToSg(plato);
  return { massKg, solidsKg, plato, sg, volumeL: massKg / (sg * RHO_WATER_20C) };
}

export interface SolveResult extends SolutionState {
  waterKg: number;
  waterL: number;
  /** True when the ingredients alone exceed the target volume (SPEC §5.2 infeasible). */
  overVolume: boolean;
}

/** SPEC §5.2 — find water mass W ≥ 0 with V(W) = V_t by bisection (V strictly increasing in W). */
export function solveForTargetVolume(components: Component[], targetVolumeL: number): SolveResult {
  if (!(targetVolumeL > 0)) throw new RangeError('Target volume must be > 0');
  const atZero = solutionState(components, 0);
  if (atZero.volumeL >= targetVolumeL) {
    return { ...atZero, waterKg: 0, waterL: 0, overVolume: atZero.volumeL > targetVolumeL * 1.0005 };
  }
  let lo = 0;
  let hi = targetVolumeL * RHO_WATER_20C;
  while (solutionState(components, hi).volumeL < targetVolumeL) hi *= 2;
  for (let i = 0; i < 200 && hi - lo > 1e-9; i++) {
    const mid = (lo + hi) / 2;
    if (solutionState(components, mid).volumeL < targetVolumeL) lo = mid;
    else hi = mid;
  }
  const waterKg = (lo + hi) / 2;
  return { ...solutionState(components, waterKg), waterKg, waterL: waterKg / RHO_WATER_20C, overVolume: false };
}

/** Fixed-water mode — SPEC §5.2. */
export function solveForWater(components: Component[], waterL: number): SolveResult {
  const waterKg = Math.max(0, waterL) * RHO_WATER_20C;
  return { ...solutionState(components, waterKg), waterKg, waterL: Math.max(0, waterL), overVolume: false };
}

export interface Contribution {
  key: string;
  label: string;
  kind: Component['kind'];
  inputKg: number;
  sugarKg: number;
  /** OG points this ingredient adds at the solved volume. */
  deltaPoints: number;
  /** Gravity points · L / kg (metric PPG). */
  pkl: number;
  ppg: number;
  /** Litres of water this ingredient displaced (water you no longer add). */
  displacedWaterL: number;
}

/** SPEC §5.4 — ΔOG = OG(all) − OG(all without it, same volume target). */
export function contributions(components: Component[], targetVolumeL: number): Contribution[] {
  const full = solveForTargetVolume(components, targetVolumeL);
  return components.map((c) => {
    const without = solveForTargetVolume(components.filter((x) => x !== c), targetVolumeL);
    const deltaPoints = points(full.sg) - points(without.sg);
    const pkl = c.inputKg > 0 ? (deltaPoints * full.volumeL) / c.inputKg : 0;
    return {
      key: c.key, label: c.label, kind: c.kind, inputKg: c.inputKg, sugarKg: c.solidsKg,
      deltaPoints, pkl, ppg: pkl * PPG_PER_PKL, displacedWaterL: without.waterL - full.waterL,
    };
  });
}

export interface Occupancy {
  /** Day-0 fermenter volume: liquid without fruit juice + intact whole fruit. */
  day0L: number;
  /** After fruit breakdown: liquid + insoluble pulp. */
  brokenDownL: number;
  headspaceFraction: number;
  recommendedFermenterL: number;
  /** Expected yield after racking off pulp and lees. */
  recoveredL: number;
  fruitRetainedL: number;
  leesLossL: number;
}

/** SPEC §5.3 — fermenter occupancy & yield. `primaryFruit` are fruit components fermented on. */
export function occupancy(components: Component[], solved: SolveResult): Occupancy {
  const fruit = components.filter((c) => c.kind === 'fruit');
  const nonFruit = components.filter((c) => c.kind !== 'fruit');
  const liquidNoFruit = solutionState(nonFruit, solved.waterKg).volumeL;
  const fruitKg = fruit.reduce((a, c) => a + c.inputKg, 0);
  const day0L = liquidNoFruit + fruitKg / RHO_FRUIT_WHOLE;
  const brokenDownL = solved.volumeL + fruit.reduce((a, c) => a + c.insolubleKg, 0) / RHO_FRUIT_INSOLUBLE;
  const headspaceFraction = fruitKg > 0 ? HEADSPACE_FRUIT : HEADSPACE_TRADITIONAL;
  const fruitRetainedL = fruit.reduce((a, c) => a + c.inputKg * (c.retentionLPerKg ?? FRUIT_RETENTION_DEFAULT), 0);
  const leesLossL = solved.volumeL * LEES_LOSS_FRACTION;
  return {
    day0L,
    brokenDownL,
    headspaceFraction,
    recommendedFermenterL: Math.max(day0L, brokenDownL) * (1 + headspaceFraction),
    recoveredL: Math.max(0, solved.volumeL - fruitRetainedL - leesLossL),
    fruitRetainedL,
    leesLossL,
  };
}
