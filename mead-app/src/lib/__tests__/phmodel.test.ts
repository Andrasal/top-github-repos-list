import { describe, expect, it } from 'vitest';
import { doseForTargetPh, phModel, PhInput } from '../phmodel';
import { fruitById, honeyById, spiceById } from '../db';
import { analyzeRecipe, DEFAULT_RECIPE } from '../recipe';
import { collectFlags } from '../flags';

const wf = honeyById('wildflower');
const base = (o: Partial<PhInput> = {}): PhInput => ({
  primaryVolumeL: 1, wholeVolumeL: 1, waterL: 0.77, alkalinityCaCO3: 0, sugarFermentedGPerL: 255,
  honeys: [{ honey: wf, massKg: 0.32 }], fruits: [], spices: [], adjustments: [], ...o,
});

describe('calibration against published meads (SPEC §22.3)', () => {
  it('AHA water-chemistry study: OG 1.100 wildflower in distilled water, must 3.7 → mead 3.4', () => {
    const r = phModel(base());
    expect(Math.abs(r.mustPh - 3.7)).toBeLessThan(0.1);
    expect(Math.abs(r.finishedPh - 3.4)).toBeLessThan(0.1);
  });
  it('AHA: low-alkalinity water ends ≈ 3.5, hard water ≈ 3.8', () => {
    expect(Math.abs(phModel(base({ alkalinityCaCO3: 50 })).finishedPh - 3.5)).toBeLessThan(0.1);
    expect(Math.abs(phModel(base({ alkalinityCaCO3: 250 })).finishedPh - 3.8)).toBeLessThan(0.15);
  });
  it('Pereira et al. 2015: 37 % honey + malic + K-tartrate, must 3.67 → mead 3.55–3.68', () => {
    const r = phModel(base({
      waterL: 0.74, alkalinityCaCO3: 20, sugarFermentedGPerL: 290, honeys: [{ honey: wf, massKg: 0.37 }],
      adjustments: [
        { uid: 'm', id: 'malic', grams: 3, stage: 'must' },
        { uid: 't', id: 'tartaric', grams: (5 * 150.09) / 226.27, stage: 'must' },
        { uid: 'k', id: 'kCarb', grams: (5 / 226.27) * 138.205, stage: 'must' },
      ],
    }));
    expect(Math.abs(r.mustPh - 3.67)).toBeLessThan(0.1);
    expect(r.finishedPh).toBeGreaterThan(3.5);
    expect(r.finishedPh).toBeLessThan(3.72);
    expect(Math.abs(r.mustTa - 4.28)).toBeLessThan(0.6);
  });
});

describe('physical behaviour', () => {
  it('every fruit lands between honey must pH and its own juice pH', () => {
    const honeyOnly = phModel(base()).mustPh;
    for (const id of ['strawberry', 'raspberry', 'cranberry', 'mango', 'banana', 'sweet-cherry']) {
      const f = fruitById(id);
      const m = phModel(base({ fruits: [{ fruit: f, massKg: f.max, stage: 'primary' }] })).mustPh;
      expect(m).toBeGreaterThanOrEqual(Math.min(honeyOnly, f.ph) - 0.05);
      expect(m).toBeLessThanOrEqual(Math.max(honeyOnly, f.ph) + 0.05);
    }
  });
  it('more acidic fruit → lower pH, monotonic with dose', () => {
    const f = fruitById('cranberry');
    const phs = [0.05, 0.15, 0.25, 0.4].map((kg) => phModel(base({ fruits: [{ fruit: f, massKg: kg, stage: 'primary' }] })).mustPh);
    for (let i = 1; i < phs.length; i++) expect(phs[i]).toBeLessThan(phs[i - 1]);
  });
  it('fermentation lowers pH and raises TA', () => {
    const r = phModel(base());
    expect(r.finishedPh).toBeLessThan(r.mustPh);
    expect(r.finishedTa).toBeGreaterThan(r.mustTa);
  });
  it('hibiscus acidifies the finished mead only (added in secondary)', () => {
    const h = spiceById('hibiscus');
    const plain = phModel(base());
    const r = phModel(base({ spices: [{ spice: h, grams: 1.5 }] }));
    expect(r.mustPh).toBeCloseTo(plain.mustPh, 10);
    expect(r.finishedPh).toBeLessThan(plain.finishedPh);
  });
  it('contribution breakdown signs make sense', () => {
    const r = phModel(base({ alkalinityCaCO3: 150, fruits: [{ fruit: fruitById('raspberry'), massKg: 0.18, stage: 'primary' }] }));
    expect(r.contributions.find((c) => c.key === 'fruit-0')!.deltaMust).toBeLessThan(0);
    expect(r.contributions.find((c) => c.key === 'water')!.deltaMust).toBeGreaterThan(0);
  });
});

describe('dose solver & recipe integration', () => {
  it('solves grams of tartaric / bicarbonate to hit a target', () => {
    const x = base({ alkalinityCaCO3: 300 });
    const g = doseForTargetPh(x, 'tartaric', 3.5)!;
    expect(g).toBeGreaterThan(0);
    const after = phModel({ ...x, adjustments: [{ uid: 'a', id: 'tartaric', grams: g, stage: 'finished' }] });
    expect(after.finishedPh).toBeCloseTo(3.5, 2);
    const cran = base({ fruits: [{ fruit: fruitById('cranberry'), massKg: 0.3, stage: 'primary' }] });
    const kb = doseForTargetPh(cran, 'kBicarb', 3.3, 'must')!;
    expect(phModel({ ...cran, adjustments: [{ uid: 'b', id: 'kBicarb', grams: kb, stage: 'must' }] }).mustPh).toBeCloseTo(3.3, 2);
  });
  it('a heavy cranberry melomel is flagged with a bicarbonate dose; the default recipe is not', () => {
    const a = analyzeRecipe({ ...DEFAULT_RECIPE, fruits: [{ uid: 'c', fruitId: 'cranberry', massKg: 2, stage: 'primary' }] });
    const flag = collectFlags(a.advisories).find((f) => f.id === 'ph-must-low');
    expect(flag?.suggestion).toMatch(/potassium bicarbonate/);
    expect(collectFlags(analyzeRecipe(DEFAULT_RECIPE).advisories).some((f) => f.id.startsWith('ph-'))).toBe(false);
  });
  it('sulfite uses the predicted pH and OIV pKa for the mead ABV', () => {
    const a = analyzeRecipe(DEFAULT_RECIPE);
    expect(a.sulfite.input.pH).toBeCloseTo(a.ph.finishedPh, 2);
    expect(a.sulfite.pKa).toBeGreaterThan(1.95);
    expect(a.fruitPhCurves[0].points).toHaveLength(4);
  });
});
