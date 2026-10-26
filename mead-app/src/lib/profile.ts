/**
 * Flavour profile, tasting note, colour preview and bottle count — SPEC §18.
 * These are illustrative heuristics built from the recipe's numbers, not sensory measurements.
 */
import type { Fruit, Honey, Spice } from './db';
import { sweetness as sweetnessOf, strength as strengthOf } from './fermentation';

export interface ProfileInput {
  og: number; fg: number; abv: number; ta: number; volumeL: number;
  honeys: { honey: Honey; massKg: number }[];
  fruits: { fruit: Fruit; massKg: number }[];
  spices: { spice: Spice; grams: number }[];
}

export const AXES = ['Sweetness', 'Acidity', 'Body', 'Warmth', 'Tannin', 'Fruit', 'Spice', 'Floral', 'Honey'] as const;
export type Axis = (typeof AXES)[number];

const clamp = (v: number) => Math.max(0, Math.min(10, v));

export function flavourProfile(x: ProfileInput): Record<Axis, number> {
  const V = x.volumeL > 0 ? x.volumeL : 1;
  const fruitInt = x.fruits.map(({ fruit, massKg }) => ({ fruit, i: massKg / V / fruit.typical }));
  const spiceInt = x.spices.map(({ spice, grams }) => ({ spice, i: (grams / V / spice.typical) * (spice.flavour ?? 1) }));
  const fruitLoad = x.fruits.reduce((a, f) => a + f.massKg, 0) / V;
  const sumBy = (groups: Spice['group'][]) => spiceInt.filter((s) => groups.includes(s.spice.group)).reduce((a, s) => a + s.i, 0);
  const structural = spiceInt.filter((s) => ['oak', 'cacao', 'coffee'].includes(s.spice.id)).reduce((a, s) => a + s.i, 0);
  const honeyKgL = x.honeys.reduce((a, h) => a + h.massKg, 0) / V;
  const honeyIntensity = x.honeys.length ? x.honeys.reduce((a, h) => a + h.honey.intensity * h.massKg, 0) / Math.max(1e-9, x.honeys.reduce((a, h) => a + h.massKg, 0)) : 0;
  const fruit = fruitInt.reduce((a, f) => a + f.i, 0);
  const spice = sumBy(['spice', 'adjunct']);
  const floral = sumBy(['floral', 'herb']);
  return {
    Sweetness: clamp(((x.fg - 0.994) / (1.04 - 0.994)) * 10),
    Acidity: clamp(((x.ta - 2) / 7) * 10),
    Body: clamp((x.fg - 0.99) * 120 + x.abv * 0.15 + fruitLoad * 2),
    Warmth: clamp(((x.abv - 3) / 17) * 10),
    Tannin: clamp(fruitInt.reduce((a, f) => a + f.fruit.tannin * Math.min(1.5, f.i), 0) * 1.6 + structural * 3),
    Fruit: clamp(fruit * 5),
    Spice: clamp(spice * 5),
    Floral: clamp(floral * 5 + (x.honeys.some((h) => ['orange-blossom', 'acacia', 'clover'].includes(h.honey.id)) ? 1 : 0)),
    Honey: clamp(honeyIntensity * Math.min(1.2, honeyKgL / 0.3) * 3.3 - (fruit + spice + floral) * 0.8),
  };
}

const word = (v: number, w: [string, string, string, string]) => (v < 2.5 ? w[0] : v < 5 ? w[1] : v < 7.5 ? w[2] : w[3]);

export function tastingNote(x: ProfileInput, p = flavourProfile(x)): string {
  const V = x.volumeL > 0 ? x.volumeL : 1;
  const sw = sweetnessOf(x.fg);
  const st = { 'sub-hydromel': 'light', hydromel: 'session', standard: 'standard-strength', sack: 'sack', 'over-sack': 'fortified-strength' }[strengthOf(x.abv)];
  const body = word(p.Body, ['light-bodied', 'medium-bodied', 'full-bodied', 'syrupy, full-bodied']);
  const leads = [
    ...x.fruits.map(({ fruit, massKg }) => ({ name: fruit.aroma, i: massKg / V / fruit.typical })),
    ...x.spices.map(({ spice, grams }) => ({ name: spice.aroma, i: (grams / V / spice.typical) * (spice.flavour ?? 1) })),
  ].filter((l) => l.i > 0).sort((a, b) => b.i - a.i);
  const describe = (l: { name: string; i: number }) => `${l.i >= 1.2 ? 'bold' : l.i >= 0.7 ? 'clear' : 'a hint of'} ${l.name}`;
  const honeyName = x.honeys.length ? x.honeys.slice().sort((a, b) => b.massKg - a.massKg)[0].honey.name.toLowerCase() : 'honey';
  const flavours = leads.length ? `${leads.slice(0, 3).map(describe).join(', ')} over ${honeyName} honey` : `pure ${honeyName} honey character`;
  const acid = word(p.Acidity, ['soft, low acidity', 'gentle acidity', 'bright acidity', 'sharp, mouth-watering acidity']);
  const tannin = p.Tannin < 1 ? '' : `, ${word(p.Tannin, ['a whisper of tannin', 'light grip', 'firm tannin', 'big, drying tannin'])}`;
  const finish = word(p.Warmth, ['a clean, easy finish', 'a smooth finish', 'a warming finish', 'a hot, port-like finish']);
  return `A ${sw}, ${body} ${st} mead: ${flavours}. ${acid[0].toUpperCase()}${acid.slice(1)}${tannin} and ${finish}.`;
}

// ── Colour preview ───────────────────────────────────────────────────────────
type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const toHex = (c: RGB) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB;

const BOTANICAL_COLOR: Record<string, string> = { hibiscus: '#b0103a', 'butterfly-pea': '#7b4bb7', rosehip: '#d2552b', calendula: '#e8a317', coffee: '#3b2414', cacao: '#5a3a26', rose: '#d98a9a' };

export function meadColor(x: ProfileInput): { hex: string; name: string } {
  const V = x.volumeL > 0 ? x.volumeL : 1;
  let c = hex('#fbf3d5'); // near water-white
  const hKg = x.honeys.reduce((a, h) => a + h.massKg, 0);
  if (hKg > 0) {
    const hc = x.honeys.reduce<RGB>((acc, h) => mix(acc, hex(h.honey.color), h.massKg / hKg), hex(x.honeys[0].honey.color));
    c = mix(c, hc, Math.min(0.85, 0.25 + (hKg / V) * 1.3));
  }
  for (const { fruit, massKg } of x.fruits) c = mix(c, hex(fruit.color), Math.min(0.9, (massKg / V / fruit.typical) * 0.8));
  for (const { spice, grams } of x.spices) {
    const col = BOTANICAL_COLOR[spice.id];
    if (col) c = mix(c, hex(col), Math.min(0.85, (grams / V / spice.typical) * 0.7));
  }
  return { hex: toHex(c), name: colourName(c) };
}

function colourName([r, g, b]: RGB): string {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 510;
  let h = 0;
  if (max !== min) {
    const d = max - min;
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  if (l > 0.82) return 'pale straw';
  if (h >= 250 && h < 330) return l < 0.35 ? 'deep purple' : 'violet';
  if (h >= 330 || h < 15) return l < 0.3 ? 'garnet' : l < 0.5 ? 'ruby' : 'rosé';
  if (h < 35) return l < 0.3 ? 'mahogany' : l < 0.55 ? 'copper' : 'peach';
  if (h < 55) return l < 0.3 ? 'dark amber' : l < 0.6 ? 'amber' : 'gold';
  return l < 0.6 ? 'old gold' : 'straw';
}

export function bottles(volumeL: number) {
  return [0.75, 0.5, 0.375, 0.33].map((size) => ({ sizeL: size, count: Math.floor(volumeL / size + 1e-9) }));
}
