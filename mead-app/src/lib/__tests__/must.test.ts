import { describe, expect, it } from 'vitest';
import { contributions, fruitComponent, honeyComponent, honeyExtractFromDensity, occupancy, solveForTargetVolume, solveForWater } from '../must';
import { KG_PER_LB, L_PER_GAL } from '../units';

const E = honeyExtractFromDensity(1.42);

describe('must solver (SPEC §5)', () => {
  it('honey extract calibrated from density 1.42 ≈ 0.797', () => {
    expect(E).toBeCloseTo(0.797, 3);
  });
  it('pure sucrose ≈ 46 PPG (brewing reference)', () => {
    const [c] = contributions([{ key: 's', label: 's', kind: 'sugar', inputKg: KG_PER_LB, liquidKg: KG_PER_LB, solidsKg: KG_PER_LB, insolubleKg: 0 }], L_PER_GAL);
    expect(c.ppg).toBeGreaterThan(45.5);
    expect(c.ppg).toBeLessThan(46.6);
  });

  it('35-PPG anchor: 1 lb honey in 1 US gal total ≈ 1.035–1.037', () => {
    const r = solveForTargetVolume([honeyComponent('h', 'honey', KG_PER_LB, E)], L_PER_GAL);
    expect(r.sg).toBeGreaterThan(1.035);
    expect(r.sg).toBeLessThan(1.037);
    expect(r.volumeL).toBeCloseTo(L_PER_GAL, 6);
  });

  it('honey PPG contribution is ≈ 35–37', () => {
    const [c] = contributions([honeyComponent('h', 'honey', KG_PER_LB, E)], L_PER_GAL);
    expect(c.ppg).toBeGreaterThan(35);
    expect(c.ppg).toBeLessThan(37);
  });

  it('hits target volume to < 1 mL', () => {
    const r = solveForTargetVolume([honeyComponent('h', 'honey', 3.5, E)], 10);
    expect(Math.abs(r.volumeL - 10)).toBeLessThan(0.001);
  });

  it('SKEPTIC PASS §5.5: 3 kg strawberries in a 10 L batch displace ~2.75 L of water', () => {
    const honey = honeyComponent('h', 'honey', 3, E);
    const fruit = fruitComponent('f', 'strawberry', 3, 8, 0.05);
    const noFruit = solveForTargetVolume([honey], 10);
    const withFruit = solveForTargetVolume([honey, fruit], 10);
    const displaced = noFruit.waterL - withFruit.waterL;
    // The juice (2.85 kg at ~1.03 SG) must REPLACE water, not be added on top.
    expect(displaced).toBeGreaterThan(2.6);
    expect(displaced).toBeLessThan(2.9);
    expect(withFruit.volumeL).toBeCloseTo(10, 3);
    // Fruit sugar raises OG; honey-only OG is lower.
    expect(withFruit.sg).toBeGreaterThan(noFruit.sg);

    const occ = occupancy([honey, fruit], withFruit);
    // Day-0: liquid w/o juice (≈7.2 L) + intact fruit (3/1.05 ≈ 2.86 L) ≈ 10.1 L
    expect(occ.day0L).toBeGreaterThan(9.9);
    expect(occ.day0L).toBeLessThan(10.3);
    expect(occ.recommendedFermenterL).toBeGreaterThan(12.8);
    expect(occ.recoveredL).toBeLessThan(10);

    const c = contributions([honey, fruit], 10).find((x) => x.key === 'f')!;
    expect(c.displacedWaterL).toBeCloseTo(displaced, 6);
    expect(c.deltaPoints).toBeGreaterThan(0);
  });

  it('flags infeasible recipes (ingredients exceed volume)', () => {
    const r = solveForTargetVolume([honeyComponent('h', 'honey', 20, E)], 10);
    expect(r.overVolume).toBe(true);
    expect(r.waterKg).toBe(0);
  });

  it('fixed-water mode derives volume', () => {
    const r = solveForWater([honeyComponent('h', 'honey', 1, E)], 3);
    expect(r.volumeL).toBeGreaterThan(3.6);
    expect(r.volumeL).toBeLessThan(3.75);
  });
});
