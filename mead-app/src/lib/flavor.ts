/**
 * Flavor Intelligence Engine — SPEC §8. Deterministic rules over the analysed recipe.
 * Thresholds are practitioner consensus (schramm, piatz, practice) unless tagged otherwise.
 */
import { ACID_TO_TARTARIC, HONEY_BASE_TA } from './constants';
import type { Fruit, Honey, Spice } from './db';
import { PAIRINGS, SPICES, FRUITS, HONEYS } from './db';
import type { Sweetness } from './fermentation';

export type Severity = 'info' | 'tip' | 'warning' | 'error';
export interface Advisory {
  id: string;
  severity: Severity;
  category: 'fruit' | 'acid' | 'tannin' | 'body' | 'gravity' | 'spice' | 'honey' | 'process';
  title: string;
  detail: string;
  suggestion?: string;
  source: string[];
}

export interface FlavorInput {
  volumeL: number; // final liquid volume (primary + secondary juice)
  og: number;
  fg: number;
  abv: number;
  abvDry: number;
  toleranceAbv: number;
  sweetness: Sweetness;
  honeys: { honey: Honey; massKg: number }[];
  fruits: { fruit: Fruit; massKg: number; stage: 'primary' | 'secondary' }[];
  spices: { spice: Spice; grams: number }[];
}

/** SPEC §8.1 */
export type FruitLoadClass = 'none' | 'light' | 'standard' | 'heavy' | 'extreme';
export function fruitLoadClass(kgPerL: number): FruitLoadClass {
  if (kgPerL <= 0) return 'none';
  if (kgPerL < 0.15) return 'light';
  if (kgPerL <= 0.35) return 'standard';
  if (kgPerL <= 0.6) return 'heavy';
  return 'extreme';
}

/** SPEC §8.2 — estimated TA (g/L tartaric eq.) of the finished mead. */
export function estimateTA(fruits: FlavorInput['fruits'], volumeL: number): number {
  if (volumeL <= 0) return HONEY_BASE_TA;
  const acid = fruits.reduce((a, { fruit, massKg }) => {
    const juiceL = massKg * (1 - fruit.insoluble); // ≈ kg ≈ L for dilute juice
    return a + juiceL * fruit.ta * ACID_TO_TARTARIC[fruit.acid];
  }, 0);
  return HONEY_BASE_TA + acid / volumeL;
}

export const TA_TARGETS: Record<Sweetness, [number, number]> = {
  dry: [4.5, 6], 'semi-sweet': [5.5, 7], sweet: [6.5, 8], dessert: [7, 9],
};

export type SpiceBand = 'imperceptible' | 'subtle' | 'typical' | 'bold' | 'assertive' | 'astronomical' | 'unit-error';
/** SPEC §8.6 */
export function spiceBand(s: Spice, gPerL: number): SpiceBand {
  if (gPerL > 3 * s.max) return 'unit-error';
  if (gPerL > s.max) return 'astronomical';
  if (gPerL > s.bold) return 'assertive';
  if (gPerL >= s.typical) return gPerL > (s.typical + s.bold) / 2 ? 'bold' : 'typical';
  if (gPerL >= s.subtle) return 'subtle';
  return 'imperceptible';
}

export interface Suggestion { forId: string; forName: string; partnerId: string; partnerName: string; note: string; startDoseGPerL?: number }

const fmt = (n: number, d = 2) => n.toFixed(d);

export function advise(x: FlavorInput): { advisories: Advisory[]; suggestions: Suggestion[]; ta: number; fruitLoad: number } {
  const out: Advisory[] = [];
  const V = x.volumeL;
  const fruitKg = x.fruits.reduce((a, f) => a + f.massKg, 0);
  const load = V > 0 ? fruitKg / V : 0;
  const loadCls = fruitLoadClass(load);

  // §8.1 Fruit load
  if (loadCls === 'light') {
    out.push({ id: 'fruit-light', severity: 'info', category: 'fruit', title: 'Light fruit load', detail: `${fmt(load)} kg/L — fruit will read as a background accent.`, suggestion: 'For a fruit-forward melomel aim for 0.15–0.35 kg/L (≈1.25–3 lb/gal).', source: ['schramm', 'piatz'] });
  } else if (loadCls === 'heavy' || loadCls === 'extreme') {
    out.push({
      id: 'fruit-heavy', severity: loadCls === 'extreme' ? 'warning' : 'tip', category: 'fruit',
      title: loadCls === 'extreme' ? 'Extreme fruit load' : 'Heavy fruit load',
      detail: `${fmt(load)} kg/L. Expect a thick fruit cap, heavy pulp losses and possible jamminess.`,
      suggestion: 'Use pectic enzyme, split fruit ½ primary / ½ secondary for fresh aroma, punch the cap 2× daily, and allow ≥30 % headspace.',
      source: ['schramm', 'practice'],
    });
  }
  if (x.fruits.some((f) => f.stage === 'primary' && /strawberry|peach|raspberry/.test(f.fruit.id))) {
    out.push({ id: 'fruit-aroma', severity: 'tip', category: 'fruit', title: 'Delicate aroma in primary', detail: 'CO₂ scrubs volatile aromatics from delicate fruit in primary.', suggestion: 'Move at least half of this fruit to secondary.', source: ['practice'] });
  }

  // §8.2 Acid balance
  const ta = estimateTA(x.fruits, V);
  const [taMin, taMax] = TA_TARGETS[x.sweetness];
  if (ta < taMin) {
    const addG = ((taMin + taMax) / 2 - ta) * V;
    out.push({
      id: 'acid-low', severity: 'tip', category: 'acid', title: 'Acidity below target for this sweetness',
      detail: `Estimated TA ${fmt(ta, 1)} g/L vs. ${taMin}–${taMax} g/L for a ${x.sweetness} mead. ${x.sweetness === 'dry' ? 'A dry mead this low in acid tastes flat and watery.' : 'Sweetness without acid tastes flabby and cloying.'}`,
      suggestion: `Bench-trial up to ~${fmt(addG, 0)} g acid blend (tartaric/malic/citric) after fermentation — add in 1 g/L steps and taste.`,
      source: ['zoecklein', 'practice'],
    });
  } else if (ta > taMax && x.fg <= 1.006) {
    out.push({ id: 'acid-high', severity: 'warning', category: 'acid', title: 'May taste sharp', detail: `Estimated TA ${fmt(ta, 1)} g/L in a dry finish (target ${taMin}–${taMax}).`, suggestion: 'Back-sweeten to 1.010–1.015, choose a malic-reducing yeast (71B), or deacidify with K₂CO₃ (≈1 g/L lowers TA ≈1 g/L).', source: ['zoecklein', 'practice'] });
  }
  const lowPh = x.fruits.filter((f) => f.stage === 'primary' && f.fruit.ph <= 3.0 && V > 0 && f.massKg / V > 0.2);
  if (lowPh.length) {
    out.push({ id: 'ph-crash', severity: 'warning', category: 'acid', title: 'pH-crash risk in primary', detail: `${lowPh.map((f) => f.fruit.name).join(', ')} at >0.2 kg/L will push must pH toward 3.0 or below; mead has little buffering.`, suggestion: 'Check pH daily; below 3.2 add K₂CO₃ in 0.25 g/L steps. Or move this fruit to secondary.', source: ['practice'] });
  }

  // §8.3 Tannin & structure
  const tannicFruit = x.fruits.some((f) => f.fruit.tannin >= 2);
  const tannicSpice = x.spices.some((s) => s.spice.id === 'oak' || s.spice.id === 'cacao' || s.spice.id === 'coffee');
  if ((x.sweetness === 'sweet' || x.sweetness === 'dessert') && !tannicFruit && !tannicSpice) {
    out.push({ id: 'tannin-sweet', severity: 'tip', category: 'tannin', title: 'Add structure to carry the sweetness', detail: 'Residual sugar with no tannin source tends to read as cloying.', suggestion: 'Add 0.1–0.3 g/L wine tannin or 2–4 g/L medium-toast oak cubes.', source: ['practice'] });
  }
  const veryTannic = x.fruits.filter((f) => f.fruit.tannin >= 3 && V > 0 && f.massKg / V > 0.3);
  if (veryTannic.length) {
    out.push({ id: 'tannin-age', severity: 'tip', category: 'tannin', title: 'Plan for ageing', detail: `${veryTannic.map((f) => f.fruit.name).join(', ')} at this load gives firm, astringent tannin.`, suggestion: 'Budget 6–12 months bulk ageing before judging balance.', source: ['practice'] });
  }

  // §8.4 Body
  if (x.abv < 7.5 && x.fg <= 1.004) {
    out.push({ id: 'body-thin', severity: 'warning', category: 'body', title: 'Session mead may finish thin', detail: `${fmt(x.abv, 1)} % ABV at FG ${x.fg.toFixed(3)} leaves little body or sweetness.`, suggestion: 'Stabilise at 1.006–1.010, use a lower-attenuating yeast, add 0.05–0.1 g/L tannin, carbonate, or use an aromatic varietal honey.', source: ['practice'] });
  }
  if (x.abv > 14 && x.fg <= 0.998) {
    out.push({ id: 'body-hot', severity: 'info', category: 'body', title: 'Strong and bone-dry', detail: 'High alcohol with no residual sugar reads hot.', suggestion: 'Age 6+ months or back-sweeten to 1.004–1.010 to integrate the alcohol.', source: ['practice'] });
  }

  // §8.5 Gravity & tolerance
  if (x.og > 1.13) {
    out.push({ id: 'og-high', severity: 'warning', category: 'gravity', title: 'Very high starting gravity', detail: `OG ${x.og.toFixed(3)} puts yeast under osmotic stress.`, suggestion: 'Step-feed: hold back ~⅓ of the honey and add it at the 1/3 sugar break.', source: ['practice'] });
  }
  if (x.abvDry - x.toleranceAbv > 2) {
    out.push({ id: 'over-tolerance', severity: 'warning', category: 'gravity', title: 'Sugar exceeds yeast tolerance', detail: `Must could reach ${fmt(x.abvDry, 1)} % but the yeast stops near ${x.toleranceAbv} % — predicted FG ${x.fg.toFixed(3)}.`, suggestion: 'Intended for a sweet mead? Fine. Otherwise reduce honey or pick a more tolerant yeast.', source: ['practice'] });
  }
  if (x.fg > 1.03) {
    out.push({ id: 'fg-cloying', severity: 'warning', category: 'gravity', title: 'Very high finishing gravity', detail: `FG ${x.fg.toFixed(3)} is cloying and fermentations this stressed often stall unpredictably.`, suggestion: 'Ferment drier and back-sweeten to taste after stabilising (sorbate + metabisulfite).', source: ['practice'] });
  }

  // §8.6 Spices
  let intensity = 0;
  for (const { spice, grams } of x.spices) {
    if (V <= 0 || grams <= 0) continue;
    const gpl = grams / V;
    intensity += gpl / spice.typical;
    const band = spiceBand(spice, gpl);
    const range = `${spice.subtle}–${spice.bold} g/L`;
    const base = { category: 'spice' as const, source: spice.source };
    if (band === 'unit-error') {
      out.push({ ...base, id: `spice-${spice.id}`, severity: 'error', title: `${spice.name}: astronomically high — check units`, detail: `${fmt(gpl)} g/L is over 3× the practical maximum (${spice.max} g/L). Did you enter kg, or a per-batch amount as per-litre?`, suggestion: `Start at ${spice.typical} g/L ≈ ${fmt(spice.typical * V, 1)} g for this batch.` });
    } else if (band === 'astronomical') {
      out.push({ ...base, id: `spice-${spice.id}`, severity: 'error', title: `${spice.name}: astronomically high`, detail: `${fmt(gpl)} g/L exceeds the ${spice.max} g/L practical ceiling and will dominate everything.`, suggestion: `Use ${spice.typical} g/L (${fmt(spice.typical * V, 1)} g); for more intensity extend contact time instead.` });
    } else if (band === 'assertive') {
      out.push({ ...base, id: `spice-${spice.id}`, severity: 'warning', title: `${spice.name}: assertive dose`, detail: `${fmt(gpl)} g/L is above the bold end of ${range}.`, suggestion: `Taste every 2–3 days and pull at ${spice.contactDays[0]}–${spice.contactDays[1]} days.` });
    } else if (band === 'imperceptible') {
      out.push({ ...base, id: `spice-${spice.id}`, severity: 'info', title: `${spice.name}: may be imperceptible`, detail: `${fmt(gpl, 3)} g/L is below the subtle threshold (${spice.subtle} g/L).` });
    } else {
      out.push({ ...base, id: `spice-${spice.id}`, severity: 'info', title: `${spice.name}: ${band} dose`, detail: `${fmt(gpl, 2)} g/L sits in the ${band} part of ${range}. Contact ${spice.contactDays[0]}–${spice.contactDays[1]} days, in secondary, in a sanitised bag.`, suggestion: spice.notes });
    }
  }
  if (intensity > 2.5) {
    out.push({ id: 'spice-combined', severity: 'warning', category: 'spice', title: 'Spices will compete', detail: `Combined spice intensity is ${fmt(intensity, 1)}× a single typical dose.`, suggestion: 'Choose one lead spice at its typical dose and keep the rest at their subtle dose.', source: ['practice'] });
  }

  // §8.8 Honey character
  for (const { honey } of x.honeys) {
    if (honey.intensity === 1 && intensity > 1.2) {
      out.push({ id: `honey-${honey.id}`, severity: 'tip', category: 'honey', title: `${honey.name} will be masked`, detail: honey.character, suggestion: 'Lower the spice to subtle doses or switch to a more assertive honey.', source: honey.source });
    } else if (honey.id === 'orange-blossom' && intensity > 1) {
      out.push({ id: `honey-${honey.id}`, severity: 'tip', category: 'honey', title: 'Orange blossom is delicate', detail: honey.character, suggestion: 'Keep spice at or below the subtle dose.', source: honey.source });
    } else if (honey.intensity === 3 && x.fruits.length === 0 && x.spices.length === 0) {
      out.push({ id: `honey-${honey.id}`, severity: 'info', category: 'honey', title: `${honey.name} traditional`, detail: honey.character, suggestion: 'A robust varietal like this rewards 12+ months of ageing.', source: honey.source });
    }
  }

  if (x.fruits.some((f) => f.stage === 'primary')) {
    out.push({ id: 'process-pectic', severity: 'info', category: 'process', title: 'Pectic enzyme', detail: 'Add pectic enzyme with fruit in primary to release juice and prevent pectin haze.', source: ['practice'] });
  }

  // §8.7 Pairings
  const suggestions: Suggestion[] = [];
  const used = new Set<string>([...x.fruits.map((f) => f.fruit.id), ...x.spices.map((s) => s.spice.id)]);
  const anchors = [
    ...x.fruits.map((f) => ({ key: f.fruit.id, name: f.fruit.name })),
    ...x.honeys.map((h) => ({ key: `honey:${h.honey.id}`, name: `${h.honey.name} honey` })),
  ];
  for (const a of anchors) {
    const partners = PAIRINGS.filter((p) => p.a === a.key && !used.has(p.b)).slice(0, 3);
    for (const p of partners) {
      const spice = SPICES.find((s) => s.id === p.b);
      const fruit = FRUITS.find((f) => f.id === p.b);
      const honey = HONEYS.find((h) => h.id === p.b);
      suggestions.push({
        forId: a.key, forName: a.name, partnerId: p.b,
        partnerName: spice?.name ?? fruit?.name ?? honey?.name ?? p.b,
        note: p.note, startDoseGPerL: spice?.typical,
      });
    }
  }

  const order: Record<Severity, number> = { error: 0, warning: 1, tip: 2, info: 3 };
  out.sort((a, b) => order[a.severity] - order[b.severity]);
  return { advisories: out, suggestions, ta, fruitLoad: load };
}
