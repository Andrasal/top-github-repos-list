import { transliterate } from '../src/engine/transliterate';
import { findIntent, search } from '../src/engine/search';

describe('transliteration', () => {
  it('uses úr for u, v, w, o-variants and y in Younger', () => {
    expect(transliterate('vow', 'younger', { oAs: 'ur' }).runes).toBe('ᚢᚢᚢ');
    expect(transliterate('ø', 'younger').runes).toBe('ᚢ');
  });
  it('collapses voiced/voiceless pairs', () => {
    expect(transliterate('dag', 'younger').runes).toBe('ᛏᛅᚴ');
    expect(transliterate('thor', 'younger').runes).toBe('ᚦᚬᚱ');
  });
  it('final -R option', () => {
    expect(transliterate('kumr', 'younger', { finalR: true }).runes).toBe('ᚴᚢᛘᛦ');
  });
  it('Elder is one-to-one with ng → ᛜ', () => {
    expect(transliterate('ingwaz', 'elder').runes).toBe('ᛁᛜᚹᚨᛉ');
  });
  it('separates words', () => {
    expect(transliterate('alu alu', 'elder').runes).toBe('ᚨᛚᚢ᛫ᚨᛚᚢ');
  });
});

describe('search', () => {
  it('finds by char, name, sound and keyword', () => {
    expect(search('ᛏ')[0].item).toMatchObject({ char: 'ᛏ' });
    expect(search('tyr')[0].item).toMatchObject({ id: 'younger-tyr' });
    expect(search('Þurs')[0].item).toMatchObject({ id: 'younger-thurs' });
    expect(search('protection').some((h) => h.type === 'rune' && h.item.char === 'ᛉ')).toBe(true);
    expect(search('vegvisir')[0]).toMatchObject({ type: 'stave' });
  });
  it('filters by alphabet', () => {
    expect(search('', { alphabet: 'younger' }).every((h) => h.type === 'rune' && h.item.alphabet === 'younger')).toBe(true);
  });
  it('maps intents fuzzily', () => {
    expect(findIntent('safety')?.id).toBe('protection');
    expect(findIntent('Courage')?.id).toBe('courage');
    expect(findIntent('money')?.id).toBe('wealth');
  });
});
