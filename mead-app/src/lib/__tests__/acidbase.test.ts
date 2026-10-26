import { describe, expect, it } from 'vitest';
import { acidAddition, addPools, meanCharge, poolFromJuice, scalePool, solvePh, titratableAcidity } from '../acidbase';

describe('acid–base model (SPEC §22)', () => {
  it('pure acid solutions match textbook pH', () => {
    // 0.1 M acetic acid: pH 2.88 ; 0.01 M citric acid: pH ≈ 2.62
    expect(solvePh({ acids: { acetic: 0.1 }, cations: 0 })).toBeCloseTo(2.88, 1);
    expect(solvePh({ acids: { citric: 0.01 }, cations: 0 })).toBeCloseTo(2.62, 1);
  });
  it('equimolar acid/salt buffer sits at pKa (Henderson–Hasselbalch)', () => {
    expect(solvePh({ acids: { acetic: 0.1 }, cations: 0.05 })).toBeCloseTo(4.76, 2);
  });
  it('mean charge spans 0 → n', () => {
    expect(meanCharge('citric', 1)).toBeLessThan(0.001);
    expect(meanCharge('citric', 1e-10)).toBeCloseTo(3, 3);
  });
  it('reconstructed juice reproduces its own pH and TA', () => {
    const p = poolFromJuice('malic', 3.4, 6.7); // apple
    expect(solvePh(p)).toBeCloseTo(3.4, 6);
    expect(titratableAcidity(p)).toBeCloseTo(6.7 * (75.04 / 67.045), 1);
  });
  it('dilution barely moves a buffered juice (non-linear blending)', () => {
    const p = poolFromJuice('citric', 3.4, 8); // strawberry-like
    const diluted = scalePool(p, 0.25); // 1 part juice : 3 parts water
    const ph = solvePh(diluted);
    expect(ph - 3.4).toBeGreaterThan(0);
    expect(ph - 3.4).toBeLessThan(0.35);
  });
  it('adding free acid lowers pH, TA rises by its equivalents', () => {
    const p = poolFromJuice('malic', 3.8, 3);
    const q = addPools(p, acidAddition('tartaric', 1, 1));
    expect(solvePh(q)).toBeLessThan(solvePh(p));
    expect(titratableAcidity(q) - titratableAcidity(p)).toBeCloseTo(1, 2);
  });
});
