/**
 * Shopping list (SPEC §31): everything to buy or weigh out for the batch, grouped, with
 * pack-size hints. Generated from the analysis so it always matches the recipe.
 */
import type { Analysis } from './recipe';
import { fruitById, honeyById, spiceById, sugarById, GROUP_LABEL } from './db';
import { BASES } from './acidbase';

export interface ShopItem { id: string; name: string; amount: string; note?: string }
export interface ShopGroup { title: string; items: ShopItem[] }
export interface Fmt { vol(l: number): string; mass(kg: number): string }

const grams = (g: number) => (g < 100 ? `${g.toFixed(1)} g` : `${g.toFixed(0)} g`);
/** Dry wine yeast is sold in 5 g sachets. */
export const YEAST_SACHET_G = 5;

export function shoppingList(a: Analysis, f: Fmt): ShopGroup[] {
  const r = a.recipe;
  const groups: ShopGroup[] = [];

  const ferm: ShopItem[] = [];
  for (const h of r.honeys.filter((x) => x.massKg > 0)) ferm.push({ id: `h-${h.uid}`, name: `${honeyById(h.honeyId).name} honey`, amount: f.mass(h.massKg) });
  for (const s of r.sugars.filter((x) => x.massKg > 0)) ferm.push({ id: `s-${s.uid}`, name: sugarById(s.sugarId).name, amount: f.mass(s.massKg) });
  for (const x of r.fruits.filter((x) => x.massKg > 0)) ferm.push({ id: `f-${x.uid}`, name: fruitById(x.fruitId).name, amount: f.mass(x.massKg), note: x.stage === 'secondary' ? 'for secondary' : 'frozen is fine' });
  if (ferm.length) groups.push({ title: 'Honey & fruit', items: ferm });

  const rh = a.rehydration;
  const sachets = Math.max(1, Math.ceil(rh.yeastG / YEAST_SACHET_G - 1e-9));
  const t = a.schedule.totals;
  const yeast: ShopItem[] = [
    { id: 'yeast', name: a.yeast.name, amount: `${sachets} × ${YEAST_SACHET_G} g sachet${sachets > 1 ? 's' : ''}`, note: `${grams(rh.yeastG)} needed` },
    { id: 'goferm', name: 'Go-Ferm (rehydration nutrient)', amount: grams(rh.goFermG) },
  ];
  if (t.fermaidO > 0) yeast.push({ id: 'fo', name: 'Fermaid O', amount: grams(t.fermaidO), note: 'split into 4 doses' });
  if (t.fermaidK > 0) yeast.push({ id: 'fk', name: 'Fermaid K', amount: grams(t.fermaidK) });
  if (t.dap > 0) yeast.push({ id: 'dap', name: 'DAP', amount: grams(t.dap) });
  groups.push({ title: 'Yeast & nutrients', items: yeast });

  const flavour: ShopItem[] = r.spices.filter((x) => x.grams > 0).map((x) => {
    const sp = spiceById(x.spiceId);
    return { id: `b-${x.uid}`, name: sp.name, amount: grams(x.grams), note: GROUP_LABEL[sp.group].toLowerCase() };
  });
  if (flavour.length) groups.push({ title: 'Flavour & additions', items: flavour });

  const finish: ShopItem[] = [];
  const so = a.sulfite;
  if (so.productGrams > 0) finish.push({ id: 'so2', name: 'Potassium metabisulfite (K-meta)', amount: grams(so.so2Grams / 0.5763), note: `or ${Math.ceil(so.campdenTablets)} Campden tablets` });
  if (so.sorbate) finish.push({ id: 'sorbate', name: 'Potassium sorbate', amount: grams(so.sorbate.grams) });
  for (const ad of r.adjustments.filter((x) => x.grams > 0)) {
    const name = ad.id in BASES ? BASES[ad.id as keyof typeof BASES].label : `${ad.id[0].toUpperCase()}${ad.id.slice(1)} acid`;
    finish.push({ id: `ad-${ad.uid}`, name, amount: grams(ad.grams), note: ad.stage === 'must' ? 'before fermentation' : 'after fermentation' });
  }
  if (finish.length) groups.push({ title: 'Stabilising & acid', items: finish });

  const b750 = a.bottles.find((b) => b.sizeL === 0.75)?.count ?? 0;
  groups.push({
    title: 'Kit',
    items: [
      { id: 'fermenter', name: 'Fermenter', amount: `≥ ${f.vol(a.occupancy.recommendedFermenterL)}`, note: 'with lid and airlock' },
      { id: 'hydrometer', name: 'Hydrometer and trial jar', amount: '1' },
      { id: 'sanitiser', name: 'No-rinse sanitiser', amount: '1' },
      { id: 'bottles', name: '750 mL bottles', amount: `${b750}`, note: 'plus corks or caps' },
    ],
  });
  return groups;
}

/** Plain text for copying into notes or a messenger. */
export function shoppingText(name: string, groups: ShopGroup[]): string {
  return [`Shopping list: ${name}`, ...groups.flatMap((g) => ['', g.title.toUpperCase(), ...g.items.map((i) => `☐ ${i.name}: ${i.amount}${i.note ? ` (${i.note})` : ''}`)])].join('\n');
}
