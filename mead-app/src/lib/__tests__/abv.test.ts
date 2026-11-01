import { describe, expect, it } from 'vitest';
import { abv, abw, AbvDomainError, abvProof, fgForAbv, linearAbvForComparisonOnly } from '../abv';

// SPEC §4 benchmark table — hand-derived from the Alternative equation.
const BENCHMARKS: [og: number, fg: number, alt: number, linear: number][] = [
  [1.05, 1.01, 5.3394, 5.25],
  [1.09, 0.996, 13.0962, 12.3375],
  [1.1, 1.0, 14.1954, 13.125],
  [1.12, 1.0, 17.5546, 15.75],
  [1.13, 1.01, 18.005, 15.75],
  [1.15, 1.02, 20.3289, 17.0625],
];

describe('Alternative ABV equation (SPEC §4)', () => {
  it.each(BENCHMARKS)('OG %f / FG %f → %f %% ABV', (og, fg, expected) => {
    expect(abv(og, fg)).toBeCloseTo(expected, 3);
  });

  it('matches the literal formula term-by-term', () => {
    const og = 1.112, fg = 1.008;
    const literal = (76.08 * (og - fg) / (1.775 - og)) * (fg / 0.794);
    expect(abv(og, fg)).toBe(literal);
  });

  it('ABV = ABW × FG/0.794 (density conversion)', () => {
    expect(abv(1.1, 1.0)).toBeCloseTo(abw(1.1, 1.0) * (1.0 / 0.794), 12);
  });

  it('is non-linear: exceeds the linear 131.25 rule increasingly with gravity', () => {
    const gap = (og: number) => abv(og, 1.0) - linearAbvForComparisonOnly(og, 1.0);
    expect(gap(1.05)).toBeGreaterThan(0);
    expect(gap(1.1)).toBeGreaterThan(gap(1.05));
    expect(gap(1.15)).toBeGreaterThan(gap(1.1));
  });

  it('is zero when nothing fermented', () => {
    expect(abv(1.1, 1.1)).toBe(0);
  });

  it('is strictly decreasing in FG and increasing in OG', () => {
    expect(abv(1.1, 1.0)).toBeGreaterThan(abv(1.1, 1.01));
    expect(abv(1.11, 1.0)).toBeGreaterThan(abv(1.1, 1.0));
  });

  it('rejects out-of-domain inputs', () => {
    expect(() => abv(1.8, 1.0)).toThrow(AbvDomainError);
    expect(() => abv(1.775, 1.0)).toThrow(AbvDomainError);
    expect(() => abv(0.99, 0.99)).toThrow(AbvDomainError);
    expect(() => abv(1.05, 1.06)).toThrow(AbvDomainError);
    expect(() => abv(1.05, 0.95)).toThrow(AbvDomainError);
    expect(() => abv(NaN, 1.0)).toThrow(AbvDomainError);
  });

  it('fgForAbv inverts abv', () => {
    for (const [og, fg] of BENCHMARKS) {
      expect(fgForAbv(og, abv(og, fg))).toBeCloseTo(fg, 6);
    }
    expect(fgForAbv(1.1, 0)).toBe(1.1);
  });

  it('proof steps reproduce the final ABV', () => {
    const p = abvProof(1.12, 1.0);
    expect(p.steps.at(-1)!.value).toBeCloseTo(p.abv, 12);
    expect(p.abv).toBeCloseTo(17.5546, 3);
    expect(p.linearComparison).toBeCloseTo(15.75, 6);
  });
});
