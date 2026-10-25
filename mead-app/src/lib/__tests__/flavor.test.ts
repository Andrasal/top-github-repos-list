import { describe, expect, it } from 'vitest';
import { advise, estimateTA, fruitLoadClass, spiceBand } from '../flavor';
import { fruitById, honeyById, spiceById } from '../db';
import { analyzeRecipe, DEFAULT_RECIPE } from '../recipe';

const base = {
  volumeL: 10, og: 1.1, fg: 1.0, abv: 14, abvDry: 14, toleranceAbv: 18, sweetness: 'dry' as const,
  honeys: [{ honey: honeyById('wildflower'), massKg: 3 }], fruits: [], spices: [],
};

describe('spice bands (SPEC §8.6)', () => {
  const cin = spiceById('cinnamon');
  it('classifies doses', () => {
    expect(spiceBand(cin, 0.1)).toBe('imperceptible');
    expect(spiceBand(cin, 0.3)).toBe('subtle');
    expect(spiceBand(cin, 0.6)).toBe('typical');
    expect(spiceBand(cin, 1.0)).toBe('bold');
    expect(spiceBand(cin, 2.0)).toBe('assertive');
    expect(spiceBand(cin, 3)).toBe('astronomical');
    expect(spiceBand(cin, 10)).toBe('unit-error');
  });
  it('raises an error for 50 g cinnamon in 10 L', () => {
    const r = advise({ ...base, spices: [{ spice: cin, grams: 50 }] });
    expect(r.advisories[0].severity).toBe('error');
    expect(r.advisories[0].title).toMatch(/astronomically/);
  });
  it('warns when spices compete', () => {
    const r = advise({ ...base, spices: [{ spice: cin, grams: 8 }, { spice: spiceById('clove'), grams: 0.8 }, { spice: spiceById('nutmeg'), grams: 1 }] });
    expect(r.advisories.some((a) => a.id === 'spice-combined')).toBe(true);
  });
});

describe('body / acid / fruit rules', () => {
  it('flags a thin session mead', () => {
    const r = advise({ ...base, og: 1.045, fg: 0.998, abv: 6.3, abvDry: 6.3 });
    expect(r.advisories.some((a) => a.id === 'body-thin')).toBe(true);
  });
  it('suggests acid for a low-acid sweet mead', () => {
    const r = advise({ ...base, fg: 1.02, sweetness: 'sweet' });
    const a = r.advisories.find((x) => x.id === 'acid-low');
    expect(a).toBeDefined();
    expect(r.ta).toBeCloseTo(0.5, 6);
  });
  it('estimates TA from fruit (citric → tartaric eq.)', () => {
    const ta = estimateTA([{ fruit: fruitById('raspberry'), massKg: 2, stage: 'primary' }], 10);
    expect(ta).toBeCloseTo(0.5 + (2 * 0.93 * 16 * (75.04 / 64.04)) / 10, 6);
  });
  it('classifies fruit loads', () => {
    expect(fruitLoadClass(0.1)).toBe('light');
    expect(fruitLoadClass(0.3)).toBe('standard');
    expect(fruitLoadClass(0.5)).toBe('heavy');
    expect(fruitLoadClass(0.8)).toBe('extreme');
  });
  it('suggests pairings not already in the recipe', () => {
    const r = advise({ ...base, fruits: [{ fruit: fruitById('sweet-cherry'), massKg: 3, stage: 'primary' }] });
    expect(r.suggestions.some((s) => s.partnerId === 'vanilla')).toBe(true);
  });
});

describe('analyzeRecipe integration', () => {
  it('default recipe analyses without errors and hits volume', () => {
    const a = analyzeRecipe(DEFAULT_RECIPE);
    expect(a.primary.volumeL).toBeCloseTo(10, 3);
    expect(a.og).toBeGreaterThan(1.09);
    expect(a.og).toBeLessThan(1.12);
    expect(a.abv).toBeGreaterThan(12);
    expect(a.schedule.doses).toHaveLength(4);
  });
  it('secondary fruit: primary OG unchanged, sugar & volume conserved, lighter juice dilutes effective OG', () => {
    const prim = analyzeRecipe({ ...DEFAULT_RECIPE, fruits: [] });
    const sec = analyzeRecipe({ ...DEFAULT_RECIPE, fruits: [{ uid: 'x', fruitId: 'tart-cherry', massKg: 2, stage: 'secondary' }] });
    expect(sec.og).toBeCloseTo(prim.og, 10);
    const cherrySugar = 2 * (1 - 0.04) * 0.14;
    expect(sec.whole.solidsKg).toBeCloseTo(sec.primary.solidsKg + cherrySugar, 10);
    expect(sec.whole.volumeL).toBeGreaterThan(sec.primary.volumeL + 1.7);
    // 14 °Bx cherry juice (≈1.057) is lighter than a ~1.094 must → effective OG drops
    expect(sec.effectiveOg).toBeLessThan(prim.og);
    expect(sec.effectiveOg).toBeGreaterThan(1.08);
  });
  it('empty recipe does not crash', () => {
    const a = analyzeRecipe({ ...DEFAULT_RECIPE, honeys: [], fruits: [], spices: [] });
    expect(a.og).toBe(1);
    expect(a.schedule.totals.fermaidO).toBe(0);
  });
  it('fixed-water mode: OG and volume derived from water', () => {
    const a = analyzeRecipe({ ...DEFAULT_RECIPE, mode: 'fixedWater', waterL: 6.118, fruits: [], spices: [] });
    expect(a.primary.waterL).toBeCloseTo(6.118, 6);
    expect(a.primary.volumeL).toBeGreaterThan(8);
  });
  it('sugar-only recipe works (dry-solid edge case)', () => {
    const a = analyzeRecipe({ ...DEFAULT_RECIPE, honeys: [], fruits: [], sugars: [{ uid: 's', sugarId: 'sucrose', massKg: 2 }] });
    expect(a.og).toBeGreaterThan(1.07);
  });
});
