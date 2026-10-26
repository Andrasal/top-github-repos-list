/** Typed access to the local JSON database — SPEC §10. */
import honeysJson from '../data/honeys.json';
import fruitsJson from '../data/fruits.json';
import spicesJson from '../data/spices.json';
import yeastsJson from '../data/yeasts.json';
import pairingsJson from '../data/pairings.json';
import type { AcidType, NDemand } from './constants';

export interface Honey { id: string; name: string; solids: number; density: number; intensity: 1 | 2 | 3; character: string; color: string; source: string[] }

/** SPEC §17 — dose bands shared by spices, flowers (g/L) and fruit (kg/L). */
export interface DoseBands { subtle: number; typical: number; bold: number; max: number }
export interface Fruit {
  id: string; name: string; brix: number; insoluble: number; ta: number; acid: AcidType; ph: number;
  tannin: 0 | 1 | 2 | 3; yan: number; retention: number; notes: string; source: string[];
  subtle: number; typical: number; bold: number; max: number; color: string; aroma: string;
}
export interface Spice {
  id: string; name: string; form: string; subtle: number; typical: number; bold: number; max: number;
  contactDays: [number, number]; notes: string; source: string[];
  group: 'spice' | 'floral' | 'herb' | 'adjunct'; aroma: string;
  /** Flavour weight (1 = default); colour-only botanicals are low. */ flavour?: number;
  /** g/L titratable acid (tartaric eq.) added per g/L of botanical. */ acidPerG?: number;
}
export interface Yeast { id: string; name: string; maker: string; tolerance: number; nDemand: NDemand; tempC: [number, number]; notes: string; source: string[] }
export interface Pairing { a: string; b: string; note: string }

export const HONEYS = honeysJson as Honey[];
export const FRUITS = fruitsJson as Fruit[];
export const SPICES = spicesJson as Spice[];
export const YEASTS = yeastsJson as Yeast[];
export const PAIRINGS = pairingsJson as Pairing[];

function finder<T extends { id: string }>(rows: T[], kind: string) {
  const map = new Map(rows.map((r) => [r.id, r]));
  return (id: string): T => {
    const r = map.get(id);
    if (!r) throw new Error(`Unknown ${kind}: ${id}`);
    return r;
  };
}
export const honeyById = finder(HONEYS, 'honey');
export const fruitById = finder(FRUITS, 'fruit');
export const spiceById = finder(SPICES, 'spice');
export const yeastById = finder(YEASTS, 'yeast');

export const SUGARS = [
  { id: 'sucrose', name: 'Table sugar (sucrose)', purity: 1.0 },
  { id: 'dextrose', name: 'Dextrose (monohydrate)', purity: 0.91 },
  { id: 'invert', name: 'Invert syrup (75 °Bx)', purity: 0.75 },
] as const;
export type SugarId = (typeof SUGARS)[number]['id'];
export const sugarById = (id: SugarId) => SUGARS.find((s) => s.id === id)!;
