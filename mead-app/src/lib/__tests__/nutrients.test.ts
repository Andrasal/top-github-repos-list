import { describe, expect, it } from 'vitest';
import { nutrientSchedule, rehydration, yanRequirement } from '../nutrients';
import { DAP_YAN, FERMAID_K_YAN, FERMAID_O_YAN_EFFECTIVE } from '../constants';

describe('YAN requirement (SPEC §7.1)', () => {
  it('OG 1.100 medium ≈ 214 ppm', () => {
    expect(yanRequirement(1.1, 'medium').grossPpm).toBeCloseTo(213.9, 0);
  });
  it('scales with demand class', () => {
    const l = yanRequirement(1.1, 'low').grossPpm;
    const h = yanRequirement(1.1, 'high').grossPpm;
    expect(h / l).toBeCloseTo(1.25 / 0.75, 10);
  });
  it('credit never makes requirement negative', () => {
    expect(yanRequirement(1.05, 'low', 10_000).netPpm).toBe(0);
  });
});

describe('SNA schedules (SPEC §7.2)', () => {
  const V = 20, Y = 240, brk = 1.07;
  it('TOSNA 3.0: four equal Fermaid O doses summing to Y/160·V', () => {
    const s = nutrientSchedule('tosna3', Y, V, brk);
    expect(s.doses).toHaveLength(4);
    expect(s.totals.fermaidO).toBeCloseTo((Y / FERMAID_O_YAN_EFFECTIVE) * V, 10);
    s.doses.forEach((d) => expect(d.fermaidO).toBeCloseTo(s.totals.fermaidO / 4, 10));
    expect(s.totals.ppm).toBeCloseTo(Y, 8);
    expect(s.doses.map((d) => d.when)).toEqual([
      '24 h after pitch', '48 h after pitch', '72 h after pitch', '1/3 sugar break or day 7 (whichever first)',
    ]);
    expect(s.doses[3].sgTrigger).toBe(brk);
  });
  it('K+DAP: no DAP at the 1/3 break, totals deliver full YAN', () => {
    const s = nutrientSchedule('kDap', Y, V, brk);
    expect(s.doses[3].dap).toBe(0);
    expect(s.totals.ppm).toBeCloseTo(Y, 8);
    expect(s.totals.dap).toBeCloseTo((0.5 * Y / DAP_YAN) * V, 10);
    expect(s.totals.fermaidK).toBeCloseTo((0.5 * Y / FERMAID_K_YAN) * V, 10);
    expect(s.warnings.filter((w) => w.severity === 'error')).toHaveLength(0);
  });
  it('Hybrid O→K delivers Y/4 per dose', () => {
    const s = nutrientSchedule('oK', Y, V, brk);
    s.doses.forEach((d) => expect(d.ppm).toBeCloseTo(Y / 4, 8));
    expect(s.doses[0].fermaidK + s.doses[1].fermaidK).toBe(0);
    expect(s.doses[2].fermaidO + s.doses[3].fermaidO).toBe(0);
  });
  it('flags DAP above legal limit', () => {
    const s = nutrientSchedule('kDap', 600, V, brk);
    expect(s.warnings.some((w) => w.severity === 'error' && /legal/.test(w.text))).toBe(true);
  });
});

describe('rehydration', () => {
  it('uses 2 g/gal normally and 1 g/L above OG 1.120', () => {
    expect(rehydration(3.785411784, 1.1).yeastG).toBeCloseTo(2, 6);
    expect(rehydration(10, 1.13).yeastG).toBeCloseTo(10, 6);
    expect(rehydration(10, 1.1).goFermG).toBeCloseTo(rehydration(10, 1.1).yeastG * 1.25, 10);
  });
});
