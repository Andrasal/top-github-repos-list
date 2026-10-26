import { audit } from '../src/engine/audit';
import { perturb, verifyHelm } from '../src/engine/correct';
import { PRESETS, buildHelm, runeHelmSpec } from '../src/engine/helm';

const fails = (r: ReturnType<typeof audit>) => r.checks.filter((c) => c.status === 'fail').map((c) => `${c.id}: ${c.message}`);

describe('helms', () => {
  it('Ægishjálmur has perfect 8-fold symmetry and passes', () => {
    const r = audit(buildHelm(PRESETS.aegishjalmur));
    expect(fails(r)).toEqual([]);
    expect(r.symmetryOrder).toBe(8);
  });
  it('Vegvísir passes with skeleton symmetry only', () => {
    const r = audit(buildHelm(PRESETS.vegvisir));
    expect(fails(r)).toEqual([]);
    expect(r.symmetryOrder).toBe(1);
  });
  for (const n of [4, 6, 8, 12, 16]) {
    it(`Ægishjálmur arms at N=${n} keep N-fold symmetry`, () => {
      const r = audit(buildHelm({ ...PRESETS.aegishjalmur, count: n }));
      expect(r.symmetryOrder).toBe(n);
    });
  }
  it('detects drift and repairs it by exact rotation', () => {
    const d = buildHelm(PRESETS.aegishjalmur);
    const drifted = { ...d, segments: perturb(d.segments, 0.01) };
    const before = audit(drifted);
    expect(before.ok).toBe(false);
    expect(before.checks.find((c) => c.id === 'A9')!.status).toBe('fail');
    const v = verifyHelm(drifted);
    expect(v.valid).toBe(true);
    expect(v.report.symmetryOrder).toBe(8);
  });
  it('fixes a pattern that cannot repeat evenly', () => {
    const v = verifyHelm(buildHelm(runeHelmSpec(['younger-tyr', 'younger-madr', 'younger-ur'], 8)));
    expect(v.design.spec.count % 3).toBe(0);
    expect(v.valid).toBe(true);
  });
  for (const ids of [['elder-algiz'], ['elder-tiwaz', 'elder-sowilo'], ['younger-madr'], ['elder-gebo'], ['elder-hagalaz'], ['elder-dagaz', 'elder-othala']]) {
    for (const n of [4, 8, 16]) {
      it(`rune helm ${ids.join('+')} ×${n} becomes valid`, () => {
        const v = verifyHelm(buildHelm(runeHelmSpec(ids, n)));
        expect(fails(v.report)).toEqual([]);
      });
    }
  }
});
