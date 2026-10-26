import { ALL_RUNES, ELDER, YOUNGER, getRune } from '../src/data';
import { composeBindrune, MAX_RUNES } from '../src/engine/bindrune';
import { audit } from '../src/engine/audit';
import { perturb, verifyBindrune } from '../src/engine/correct';
import { withSegments } from '../src/engine/bindrune';
import { variants } from '../src/engine/glyph';

const fails = (r: ReturnType<typeof audit>) => r.checks.filter((c) => c.status === 'fail').map((c) => c.id);

describe('bindrune composition', () => {
  it('every single rune passes on its own', () => {
    for (const r of ALL_RUNES) expect([r.char, fails(audit(composeBindrune([r.id])))]).toEqual([r.char, []]);
  });
  it('never mirrors ᚾ/ᛅ or flips ᛉ/ᛘ/ᛦ into another rune', () => {
    for (const id of ['younger-naudr', 'younger-ar', 'elder-naudiz'])
      expect(variants(getRune(id)).every((p) => !p.mirror && !p.flip)).toBe(true);
    for (const id of ['elder-algiz', 'younger-madr', 'younger-yr'])
      expect(variants(getRune(id)).every((p) => !p.flip)).toBe(true);
  });
  it('draws the shared stem exactly once', () => {
    const d = composeBindrune(['younger-tyr', 'younger-fe', 'younger-logr']);
    expect(d.segments.filter((s) => Math.abs(s.a.x) < 1e-6 && Math.abs(s.b.x) < 1e-6)).toHaveLength(1);
  });
  it('refuses more than six runes', () => {
    expect(() => composeBindrune(new Array(MAX_RUNES + 1).fill('elder-isaz'))).toThrow();
  });
  it('all pairs: at most the five known geometric conflicts stay invalid', () => {
    const invalid: string[] = [];
    for (const set of [ELDER, YOUNGER])
      for (let i = 0; i < set.length; i++)
        for (let j = i + 1; j < set.length; j++)
          if (!verifyBindrune(composeBindrune([set[i].id, set[j].id])).valid) invalid.push(set[i].char + set[j].char);
    expect(invalid.sort()).toEqual(['ᛇᛈ', 'ᛇᛏ', 'ᛇᛒ', 'ᛈᛉ', 'ᛈᛏ'].sort());
  });
  it('an invalid result keeps clean (unsnapped) coordinates', () => {
    const v = verifyBindrune(composeBindrune(['elder-eihwaz', 'elder-tiwaz']));
    expect(v.valid).toBe(false);
    expect(fails(v.report)).toEqual(['A4']);
  });
});

describe('Skeptic repairs drift', () => {
  for (const ids of [
    ['younger-tyr', 'younger-sol'],
    ['elder-fehu', 'elder-othala', 'elder-jera'],
    ['younger-madr', 'younger-thurs', 'younger-yr'],
    ['elder-fehu', 'elder-tiwaz', 'elder-laguz', 'elder-isaz'],
  ]) {
    it(ids.map((id) => getRune(id).char).join(''), () => {
      const d = composeBindrune(ids);
      expect(audit(d).ok).toBe(true);
      const drifted = withSegments(d, perturb(d.segments, 0.012, 3));
      const before = audit(drifted);
      expect(before.ok).toBe(false);
      const v = verifyBindrune(drifted);
      expect(v.valid).toBe(true);
      expect(fails(v.report)).toEqual([]);
    });
  }
});

describe('Skeptic closes inherent gaps', () => {
  it('ᚢᛏᛊᛒ: no layout is clean as drawn, so near-misses are snapped into joints and every rune stays readable', () => {
    const d = composeBindrune(['elder-uruz', 'elder-tiwaz', 'elder-sowilo', 'elder-berkanan']);
    expect(fails(audit(d))).toEqual(['A4']);
    const v = verifyBindrune(d);
    expect(v.valid).toBe(true);
    expect(v.report.checks.find((c) => c.id === 'A8')!.status).toBe('pass');
  });
});
