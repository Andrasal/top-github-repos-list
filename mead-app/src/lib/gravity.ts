/** Gravity ⇄ sugar math — SPEC §3. Sources: lincoln, asbc. */
import { RHO_WATER_20C } from './constants';

const K = 227.1 / 258.2; // SPEC §3.2

/** SPEC §3.1 — Lincoln equation. P in °Plato (≈ °Brix). */
export function platoToSg(p: number): number {
  if (!Number.isFinite(p) || p < 0 || p > 90) throw new RangeError(`Plato out of range: ${p}`);
  return 1 + p / (258.6 - (p / 258.2) * 227.1);
}

/** SPEC §3.2 — exact algebraic inverse of platoToSg, so round-trips never drift. */
export function sgToPlato(sg: number): number {
  if (!Number.isFinite(sg) || sg < 0.98 || sg > 1.8) throw new RangeError(`SG out of range: ${sg}`);
  const x = sg - 1;
  return (258.6 * x) / (1 + K * x);
}

export const sgToBrix = sgToPlato;
export const brixToSg = platoToSg;
export const points = (sg: number) => (sg - 1) * 1000;

export interface Liquid {
  volumeL: number;
  sg: number;
  abv?: number;
}

/** SPEC §3.3 — mass-based blend of liquids (unfermented: Plato model). */
export function blend(liquids: Liquid[]): { volumeL: number; sg: number; plato: number; abv: number } {
  const valid = liquids.filter((l) => l.volumeL > 0);
  if (valid.length === 0) throw new RangeError('Nothing to blend');
  let mass = 0;
  let solids = 0;
  let alc = 0;
  let vol = 0;
  for (const l of valid) {
    const m = l.volumeL * l.sg * RHO_WATER_20C;
    mass += m;
    solids += (m * Math.max(0, sgToPlato(l.sg))) / 100;
    alc += l.volumeL * (l.abv ?? 0);
    vol += l.volumeL;
  }
  const plato = (100 * solids) / mass;
  const sg = platoToSg(plato);
  return { volumeL: mass / (sg * RHO_WATER_20C), sg, plato, abv: alc / vol };
}
