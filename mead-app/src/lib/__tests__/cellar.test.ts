import { describe, expect, it } from 'vitest';
import { benchTrial, caloriesPerServing, hydrometerCorrect, refractometerFg, refractometerOg, sulfitePpmFromGrams, waterDensity } from '../cellar';
import { honeyOnly, honeyPerKg, planPrimary, solveBlend, spiritDensity } from '../backsweeten';
import { brewDaySteps } from '../brewday';
import { abv } from '../abv';
import { analyzeRecipe, DEFAULT_RECIPE } from '../recipe';
import { PRESETS } from '../presets';

describe('cellar tools (SPEC §26)', () => {
  it('water density matches CRC values', () => {
    expect(waterDensity(4)).toBeCloseTo(0.999975, 5);
    expect(waterDensity(20)).toBeCloseTo(0.998207, 5);
    expect(waterDensity(30)).toBeCloseTo(0.995650, 5);
  });
  it('corrects a warm hydrometer reading upward and leaves a reading at calibration temperature alone', () => {
    expect(hydrometerCorrect(1.05, 20, 20)).toBeCloseTo(1.05, 6);
    expect(hydrometerCorrect(1.05, 30, 20)).toBeCloseTo(1.0527, 3); // published tables: ≈ +2.6 to +2.8 pts at 30 °C
    expect(hydrometerCorrect(1.05, 10, 20)).toBeLessThan(1.05);
    expect(hydrometerCorrect(1.0, 15.56, 15.56)).toBeCloseTo(1.0, 6);
  });
  it('converts refractometer readings', () => {
    expect(refractometerOg(20.7)).toBeCloseTo(1.086, 3);
    expect(refractometerOg(21.5, 1.04)).toBeCloseTo(refractometerOg(21.5 / 1.04), 9);
    expect(refractometerFg(12, 6)).toBeCloseTo(1.0117, 3); // Terrill cubic, typical beer case
  });
  it('estimates calories for a glass', () => {
    expect(caloriesPerServing(12, 10, 150)).toBeCloseTo(105.4, 0);
    expect(caloriesPerServing(0, 0, 150)).toBe(0);
  });
  it('scales a bench trial and reverses a sulfite weighing', () => {
    expect(benchTrial(100, 50, 10)).toEqual({ gPerL: 0.5, grams: 5 });
    expect(sulfitePpmFromGrams(0.82, 9.5)).toBeCloseTo(49.7, 1);
    expect(sulfitePpmFromGrams(1, 0)).toBe(0);
  });
});

describe('back-sweetening (SPEC §27)', () => {
  it('uses real ethanol–water densities, not a straight-line blend', () => {
    expect(spiritDensity(0)).toBeCloseTo(0.99823, 5);
    expect(spiritDensity(40)).toBeCloseTo(0.948, 2); // OIML: 948.0 kg/m³; a linear blend would give 0.918
    expect(spiritDensity(40)).toBeGreaterThan(0.945);
    expect(spiritDensity(100)).toBeCloseTo(0.78934, 5);
  });
  it('honey per kg agrees with the calibrated must model (≈ 36.5 PPG ≈ 305 PKL)', () => {
    const h = honeyPerKg();
    expect(h.pkl).toBeGreaterThan(300);
    expect(h.pkl).toBeLessThan(315);
    expect(h.litres).toBeCloseTo(0.693, 2);
  });
  it('honey alone hits the gravity but dilutes the alcohol, conserving sugar points and alcohol', () => {
    const m = { volumeL: 10, sg: 0.996, abv: 14 };
    const r = honeyOnly(m, 1.016);
    const h = honeyPerKg();
    expect(r.honeyKg).toBeCloseTo(0.672, 2);
    expect((((m.sg - 1) * 1000 * m.volumeL + h.pkl * r.honeyKg) / r.volumeL) / 1000 + 1).toBeCloseTo(1.016, 6);
    expect(r.abv * r.volumeL).toBeCloseTo(14 * 10, 6);
    expect(r.abv).toBeLessThan(14);
  });
  it('honey + spirit lands on both targets', () => {
    const m = { volumeL: 9.5, sg: 1.0, abv: 11.96 };
    const r = solveBlend(m, { sg: 1.016, abv: 13 }, 40);
    expect(r.ok).toBe(true);
    expect(r.partner).toBe('spirit');
    const h = honeyPerKg();
    const ps = (spiritDensity(40) / 0.9982 - 1) * 1000;
    const V = m.volumeL + r.honeyKg * h.litres + r.partnerL;
    expect(V).toBeCloseTo(r.volumeL, 9);
    expect(((m.sg - 1) * 1000 * m.volumeL + h.pkl * r.honeyKg + ps * r.partnerL) / V).toBeCloseTo(16, 6);
    expect((m.abv * m.volumeL + 40 * r.partnerL) / V).toBeCloseTo(13, 6);
  });
  it('honey + water when the target ABV is below what honey alone gives', () => {
    const r = solveBlend({ volumeL: 10, sg: 0.996, abv: 14 }, { sg: 1.012, abv: 11 });
    expect(r.ok).toBe(true);
    expect(r.partner).toBe('water');
    expect(r.partnerL).toBeGreaterThan(0);
  });
  it('explains impossible targets instead of returning negative amounts', () => {
    const r = solveBlend({ volumeL: 10, sg: 0.996, abv: 14 }, { sg: 1.016, abv: 45 }, 40);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/spirit/);
  });
  it('plans a higher primary OG so back-sweetening lands on the target ABV', () => {
    const p = planPrimary(10, 0.996, { sg: 1.016, abv: 13 });
    expect(p.abvBefore).toBeGreaterThan(13);
    expect(abv(p.requiredOg, 0.996)).toBeCloseTo(p.abvBefore, 3);
    expect(p.abvBefore / p.dilution).toBeCloseTo(13, 9);
  });
});

describe('brew-day checklist (SPEC §28)', () => {
  const fmt = { vol: (l: number) => `${l.toFixed(2)} L`, mass: (kg: number) => `${kg.toFixed(2)} kg` };
  it('builds concrete steps with stable, unique ids', () => {
    const steps = brewDaySteps(analyzeRecipe(DEFAULT_RECIPE), fmt);
    const ids = steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['sanitise', 'pitch', 'dose-1', 'dose-4', 'rack1', 'bottle']));
    expect(steps.find((s) => s.id === 'honey-h1')?.text).toMatch(/3\.00 kg of wildflower/);
    expect(steps.find((s) => s.id === 'spice-s1')?.phase).toBe('secondary');
  });
  it('works for every style preset', () => {
    for (const p of PRESETS) expect(brewDaySteps(analyzeRecipe({ ...DEFAULT_RECIPE, ...p.recipe }), fmt).length).toBeGreaterThan(10);
  });
});

describe('adjuncts (SPEC §30)', () => {
  const fmt = { vol: (l: number) => `${l.toFixed(2)} L`, mass: (kg: number) => `${kg.toFixed(2)} kg` };
  const withSpices = (spices: { spiceId: string; grams: number }[]) =>
    analyzeRecipe({ ...DEFAULT_RECIPE, spices: spices.map((x, i) => ({ uid: `x${i}`, ...x })) });
  it('puts each adjunct at the right moment in the checklist', () => {
    const a = withSpices([{ spiceId: 'phenylalanine', grams: 2 }, { spiceId: 'oak-fr-cubes', grams: 25 }, { spiceId: 'tannin-chestnut', grams: 1 }, { spiceId: 'bentonite', grams: 5 }]);
    const steps = brewDaySteps(a, fmt);
    const at = (id: string) => steps.find((s) => s.id === id)!;
    expect(at('spice-x0').phase).toBe('brew');
    expect(steps.findIndex((s) => s.id === 'spice-x0')).toBeLessThan(steps.findIndex((s) => s.id === 'pitch'));
    expect(at('spice-x1').phase).toBe('secondary');
    expect(at('spice-x1').detail).toMatch(/28–84 days/);
    expect(at('spice-x2').detail).toMatch(/Dissolve/);
    expect(at('spice-x3').phase).toBe('finish');
  });
  it('tannin powders and woods add structure; process aids add no flavour', () => {
    const base = withSpices([]).profile;
    const tannin = withSpices([{ spiceId: 'tannin-chestnut', grams: 1 }]).profile;
    const aid = withSpices([{ spiceId: 'bentonite', grams: 5 }]).profile;
    const phe = withSpices([{ spiceId: 'phenylalanine', grams: 2 }]).profile;
    expect(tannin.Tannin).toBeGreaterThan(base.Tannin + 2);
    expect(aid).toEqual(base);
    expect(phe.Floral).toBeGreaterThan(base.Floral);
    expect(phe.Spice).toBe(base.Spice);
  });
  it('L-phenylalanine bands follow the 0.14–0.28 g/L practice range', async () => {
    const { spiceById } = await import('../db');
    const p = spiceById('phenylalanine');
    expect([p.subtle, p.bold]).toEqual([0.14, 0.28]);
  });
  it('a sweet mead with a tannin powder no longer gets the “add structure” tip', () => {
    const sweet = { ...DEFAULT_RECIPE, fruits: [], targetFg: 1.02 };
    const ids = (sp: { spiceId: string; grams: number }[]) => analyzeRecipe({ ...sweet, spices: sp.map((x, i) => ({ uid: `t${i}`, ...x })) }).advisories.map((x) => x.id);
    expect(ids([])).toContain('tannin-sweet');
    expect(ids([{ spiceId: 'tannin-grape', grams: 0.8 }])).not.toContain('tannin-sweet');
  });
});

describe('shopping list (SPEC §31)', async () => {
  const { shoppingList, shoppingText } = await import('../shopping');
  const fmt = { vol: (l: number) => `${l.toFixed(2)} L`, mass: (kg: number) => `${kg.toFixed(2)} kg` };
  it('lists honey, yeast sachets, nutrient totals, additions and kit', () => {
    const a = analyzeRecipe({ ...DEFAULT_RECIPE, targetFg: 1.012, adjustments: [{ uid: 'a1', id: 'tartaric', grams: 4, stage: 'finished' }] });
    const g = shoppingList(a, fmt);
    const all = g.flatMap((x) => x.items);
    expect(all.find((i) => i.id === 'h-h1')?.amount).toBe('3.00 kg');
    expect(all.find((i) => i.id === 'yeast')?.amount).toMatch(/^2 × 5 g sachets$/); // 5.3 g needed
    expect(all.find((i) => i.id === 'fo')?.amount).toBe(`${a.schedule.totals.fermaidO.toFixed(1)} g`);
    expect(all.some((i) => i.id === 'sorbate')).toBe(true);
    expect(all.find((i) => i.id === 'ad-a1')?.name).toBe('Tartaric acid');
    expect(shoppingText('Test', g)).toMatch(/☐ Wildflower honey: 3\.00 kg/);
  });
});
