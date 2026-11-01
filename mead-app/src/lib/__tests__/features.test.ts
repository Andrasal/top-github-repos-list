import { describe, expect, it } from 'vitest';
import { analyzeRecipe, DEFAULT_RECIPE, Recipe } from '../recipe';
import { designForTarget, ogForTarget, scaleRecipe } from '../designer';
import { PRESETS, PRESET_BASE_VOLUME_L } from '../presets';
import { collectFlags } from '../flags';
import { fruitBand, doseBand } from '../flavor';
import { fruitById, spiceById, FRUITS, SPICES } from '../db';
import { abv } from '../abv';
import { trackerStatus, EMPTY_LOG } from '../tracker';
import { meadColor, bottles } from '../profile';

const fromPreset = (id: string): Recipe => {
  const p = PRESETS.find((x) => x.id === id)!;
  return { ...DEFAULT_RECIPE, ...p.recipe, targetVolumeL: PRESET_BASE_VOLUME_L };
};

describe('dose bands (SPEC §17)', () => {
  it('every fruit and botanical has ordered bands', () => {
    for (const b of [...FRUITS, ...SPICES]) {
      expect(b.subtle).toBeLessThan(b.typical);
      expect(b.typical).toBeLessThan(b.bold);
      expect(b.bold).toBeLessThan(b.max);
    }
  });
  it('fruit is judged on its own intensity', () => {
    expect(fruitBand(fruitById('raspberry'), 0.3)).toBe('bold');
    expect(fruitBand(fruitById('blueberry'), 0.3)).toBe('subtle');
    expect(fruitBand(fruitById('black-currant'), 0.5)).toBe('astronomical');
    expect(doseBand(spiceById('elderflower'), 1)).toBe('typical');
  });
  it('an overdosed fruit raises an error flag', () => {
    const a = analyzeRecipe({ ...DEFAULT_RECIPE, fruits: [{ uid: 'x', fruitId: 'black-currant', massKg: 5, stage: 'primary' }] });
    expect(collectFlags(a.advisories).some((f) => f.id === 'fruit-dose-black-currant' && f.severity === 'error')).toBe(true);
  });
});

describe('presets (SPEC §19.3)', () => {
  it.each(PRESETS.map((p) => p.id))('%s analyses cleanly with no error flags', (id) => {
    const a = analyzeRecipe(fromPreset(id));
    expect(a.abv).toBeGreaterThan(4);
    expect(collectFlags(a.advisories).filter((f) => f.severity === 'error')).toEqual([]);
  });
});

describe('designer (SPEC §19)', () => {
  it('ogForTarget inverts the Alternative ABV equation', () => {
    const og = ogForTarget(12, 1.01);
    expect(abv(og, 1.01)).toBeCloseTo(12, 6);
  });
  it('solves the honey for a 12 % semi-sweet target', () => {
    const t = designForTarget({ ...DEFAULT_RECIPE, fruits: [], spices: [], yeastId: 'ec1118' }, 12, 1.01);
    expect(t.achievedAbv).toBeCloseTo(12, 1);
    expect(t.recipe.targetFg).toBe(1.01);
    expect(t.honeyKg).toBeGreaterThan(2);
  });
  it('accounts for fruit sugar when solving honey', () => {
    const plain = designForTarget({ ...DEFAULT_RECIPE, fruits: [], yeastId: 'ec1118' }, 12, 0.996);
    const fruity = designForTarget({ ...DEFAULT_RECIPE, fruits: [{ uid: 'g', fruitId: 'grape', massKg: 3, stage: 'primary' }], yeastId: 'ec1118' }, 12, 0.996);
    expect(fruity.honeyKg).toBeLessThan(plain.honeyKg);
    expect(fruity.achievedAbv).toBeCloseTo(12, 1);
  });
  it('scaling keeps OG and ABV', () => {
    const a = analyzeRecipe(DEFAULT_RECIPE);
    const b = analyzeRecipe(scaleRecipe(DEFAULT_RECIPE, 1.892706));
    expect(b.og).toBeCloseTo(a.og, 4);
    expect(b.primary.volumeL).toBeCloseTo(18.92706, 3);
  });
});

describe('tracker (SPEC §20)', () => {
  const t0 = Date.parse('2026-10-01T18:00:00Z');
  const day = 86_400_000;
  const r = (d: number, sg: number) => ({ uid: String(d), at: new Date(t0 + d * day).toISOString(), sg });
  it('times the nutrient doses from pitch', () => {
    const s = trackerStatus({ ...EMPTY_LOG, pitchedAt: new Date(t0).toISOString() }, 1.1, 0.996, t0 + 1.1 * day);
    expect(s.doses.map((d) => d.state)).toEqual(['due', 'upcoming', 'upcoming', 'upcoming']);
  });
  it('makes dose 4 due at the ⅓ break, before day 7', () => {
    const s = trackerStatus({ ...EMPTY_LOG, pitchedAt: new Date(t0).toISOString(), readings: [r(0, 1.1), r(4, 1.06)], dosesDone: [true, true, true, false] }, 1.1, 0.996, t0 + 4 * day);
    expect(s.breakReached).toBe(true);
    expect(s.doses[3].state).toBe('due');
    expect(s.currentAbv).toBeCloseTo(abv(1.1, 1.06), 10);
  });
  it('detects a stuck ferment and a finished one', () => {
    const stuck = trackerStatus({ ...EMPTY_LOG, pitchedAt: new Date(t0).toISOString(), readings: [r(0, 1.1), r(10, 1.03), r(11.5, 1.03), r(13, 1.0295)], dosesDone: [true, true, true, true] }, 1.1, 0.996, t0 + 13 * day);
    expect(stuck.stage).toBe('stuck');
    expect(collectFlags([], stuck).some((f) => f.id === 'tracker-stuck')).toBe(true);
    const done = trackerStatus({ ...EMPTY_LOG, pitchedAt: new Date(t0).toISOString(), readings: [r(0, 1.1), r(20, 0.997), r(21.5, 0.997), r(23, 0.9968)], dosesDone: [true, true, true, true] }, 1.1, 0.996, t0 + 23 * day);
    expect(done.stage).toBe('stable');
  });
});

describe('profile extras', () => {
  it('colour and bottles', () => {
    const a = analyzeRecipe(fromPreset('dark-bramble'));
    expect(a.color.hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(['garnet', 'ruby', 'deep purple', 'mahogany', 'dark amber', 'violet']).toContain(a.color.name);
    expect(bottles(7.5)[0]).toEqual({ sizeL: 0.75, count: 10 });
    expect(meadColor({ og: 1.05, fg: 1, abv: 6, ta: 1, volumeL: 10, honeys: [], fruits: [], spices: [] }).name).toBe('pale straw');
  });
  it('tasting note mentions the lead flavours', () => {
    const a = analyzeRecipe(fromPreset('cherry-vanilla'));
    expect(a.tastingNote).toMatch(/sour cherry/);
    expect(a.tastingNote).toMatch(/dessert|sweet/);
  });
});
