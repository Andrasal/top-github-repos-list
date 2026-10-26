import { ALL_RUNES, ELDER, YOUNGER, INTENTS, getRune } from '../src/data';

describe('data', () => {
  it('has 24 elder and 16 younger runes with unique ids', () => {
    expect(ELDER).toHaveLength(24);
    expect(YOUNGER).toHaveLength(16);
    expect(new Set(ALL_RUNES.map((r) => r.id)).size).toBe(40);
  });
  it('maps úr to u, v, w, o, ø', () => {
    expect(getRune('younger-ur').sounds).toEqual(expect.arrayContaining(['u', 'v', 'w', 'o', 'ø']));
  });
  it('intents reference real runes', () => {
    for (const i of INTENTS) for (const id of [...i.elder, ...i.younger]) expect(() => getRune(id)).not.toThrow();
  });
  it('every rune carries an evidence layer on each meaning', () => {
    for (const r of ALL_RUNES) for (const m of r.magical) expect(['attested', 'literary', 'modern']).toContain(m.layer);
  });
});
