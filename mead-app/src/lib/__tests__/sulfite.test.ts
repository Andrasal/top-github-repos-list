import { describe, expect, it } from 'vitest';
import { freeForMolecular, molecularFraction, molecularSo2, so2Pka, sulfitePlan } from '../sulfite';
import { KMETA_SO2_FRACTION } from '../constants';
import { L_PER_GAL } from '../units';

const base = { volumeL: 5 * L_PER_GAL, abv: 0, pH: 3.5, currentFreePpm: 0, currentTotalPpm: 0, targetMolecularPpm: 0.8, bindingPct: 0, form: 'kmeta' as const, sorbate: false };

describe('SO2 equilibrium (SPEC §13.1)', () => {
  it('pH 3.5 → ~2.0 % molecular (published pKa-1.81 tables)', () => {
    expect(molecularFraction(3.5) * 100).toBeCloseTo(2.0, 1);
    expect(molecularFraction(4.0) * 100).toBeCloseTo(0.64, 1);
  });
  it('0.8 mg/L molecular at pH 3.5 needs ≈ 40 mg/L free', () => {
    expect(freeForMolecular(0.8, 3.5)).toBeCloseTo(39.98, 1);
    expect(molecularSo2(freeForMolecular(0.8, 3.3), 3.3)).toBeCloseTo(0.8, 10);
  });
  it('K-meta is 57.6 % SO2 by mass', () => {
    expect(KMETA_SO2_FRACTION).toBeCloseTo(0.5763, 4);
  });
});

describe('OIV pKa by alcohol (SPEC §13.1)', () => {
  // OIV-MA-AS323-04C Table III, 20 °C: molecular % of free SO2
  it.each([[0, 3.5, 1.64], [5, 3.5, 2.04], [10, 3.5, 2.54], [15, 3.5, 3.16], [20, 3.5, 3.95], [10, 3.6, 2.03], [15, 3.8, 1.61], [10, 3.0, 7.61], [0, 2.8, 7.73]])(
    '%i %% ABV, pH %f → %f %% molecular', (abv, pH, pct) => {
      expect(molecularFraction(pH, so2Pka(abv)) * 100).toBeCloseTo(pct, 1);
    });
  it('interpolates between table rows', () => {
    expect(so2Pka(12.5)).toBeCloseTo((1.916 + 2.014) / 2, 6);
    expect(so2Pka(-3)).toBe(1.723);
  });
});

describe('sulfitePlan (SPEC §13.2)', () => {
  const free12 = 0.8 / molecularFraction(3.5, so2Pka(12));
  it('5 gal of 12 % mead at pH 3.5 needs ~29 mg/L free → ~0.95 g K-meta', () => {
    const p = sulfitePlan({ ...base, abv: 12 });
    expect(p.pKa).toBeCloseTo(1.955, 3);
    expect(p.additionPpm).toBeCloseTo(free12, 6);
    expect(free12).toBeGreaterThan(27);
    expect(free12).toBeLessThan(31);
    expect(p.productGrams).toBeCloseTo((free12 * 5 * L_PER_GAL) / 1000 / 0.5763, 2);
    expect(p.after.molecularPpm).toBeCloseTo(0.8, 6);
    expect(p.after.totalPpm).toBeCloseTo(p.additionPpm, 10);
  });
  it('alcohol lowers the requirement vs a plain-water calculation by ~40 % at 12 %', () => {
    const water = sulfitePlan({ ...base, abv: 0 }).additionPpm;
    const mead = sulfitePlan({ ...base, abv: 12 }).additionPpm;
    expect(mead / water).toBeGreaterThan(0.55);
    expect(mead / water).toBeLessThan(0.7);
  });
  it('1 Campden tablet per gallon ≈ 67 mg/L', () => {
    const p = sulfitePlan({ ...base, volumeL: L_PER_GAL, targetMolecularPpm: 67 * molecularFraction(3.5, so2Pka(0)) });
    expect(p.campdenTablets).toBeCloseTo(1, 2);
  });
  it('credits existing free SO2 and accounts for binding', () => {
    const need = 0.8 / molecularFraction(3.5, so2Pka(0));
    const p = sulfitePlan({ ...base, currentFreePpm: 20, currentTotalPpm: 60, bindingPct: 50 });
    expect(p.additionPpm).toBeCloseTo((need - 20) / 0.5, 6);
    expect(p.after.freePpm).toBeCloseTo(need, 6);
    expect(p.after.totalPpm).toBeCloseTo(60 + p.additionPpm, 6);
  });
  it('adds nothing when already protected', () => {
    expect(sulfitePlan({ ...base, currentFreePpm: 60, currentTotalPpm: 90 }).additionPpm).toBe(0);
  });
  it('flags legal limits and high pH', () => {
    const p = sulfitePlan({ ...base, pH: 4.1, currentTotalPpm: 250, currentFreePpm: 10 });
    expect(p.warnings.some((w) => w.severity === 'error' && /US limit/.test(w.text))).toBe(true);
    expect(p.warnings.some((w) => /pH 4.10/.test(w.text))).toBe(true);
  });
  it('sorbate 0.2 g/L ≈ 149 mg/L sorbic acid', () => {
    const p = sulfitePlan({ ...base, sorbate: true });
    expect(p.sorbate!.sorbicPpm).toBeCloseTo(149.3, 0);
    expect(p.sorbate!.grams).toBeCloseTo(0.2 * base.volumeL, 10);
  });
  it('stock solution: 10 % K-meta delivers 57.6 mg SO2 per mL', () => {
    const p = sulfitePlan(base);
    expect(p.stockSolutionMl * 57.63).toBeCloseTo(p.so2Grams * 1000, 0);
  });
});
