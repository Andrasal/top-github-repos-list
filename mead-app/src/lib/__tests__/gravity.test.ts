import { describe, expect, it } from 'vitest';
import { blend, platoToSg, sgToPlato } from '../gravity';

describe('Plato ⇄ SG (SPEC §3)', () => {
  it('matches sucrose anchors', () => {
    expect(platoToSg(10)).toBeCloseTo(1.04, 3);
    expect(platoToSg(20)).toBeCloseTo(1.083, 3);
    expect(platoToSg(0)).toBe(1);
  });
  it('round-trips exactly', () => {
    for (let p = 0; p <= 40; p += 2.5) expect(sgToPlato(platoToSg(p))).toBeCloseTo(p, 10);
  });
  it('OG 1.100 ≈ 23.8 °Bx', () => {
    expect(sgToPlato(1.1)).toBeCloseTo(23.77, 2);
  });
});

describe('blend (SPEC §3.3)', () => {
  it('blending water halves sugar concentration by mass', () => {
    const b = blend([{ volumeL: 1, sg: 1.08 }, { volumeL: 1, sg: 1.0 }]);
    expect(b.sg).toBeGreaterThan(1.039);
    expect(b.sg).toBeLessThan(1.041);
  });
  it('blending identical liquids is identity', () => {
    const b = blend([{ volumeL: 3, sg: 1.05, abv: 10 }, { volumeL: 2, sg: 1.05, abv: 10 }]);
    expect(b.sg).toBeCloseTo(1.05, 10);
    expect(b.volumeL).toBeCloseTo(5, 10);
    expect(b.abv).toBeCloseTo(10, 10);
  });
  it('volume-weights ABV', () => {
    expect(blend([{ volumeL: 3, sg: 1.0, abv: 12 }, { volumeL: 1, sg: 1.0, abv: 0 }]).abv).toBeCloseTo(9, 10);
  });
});
