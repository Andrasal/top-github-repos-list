import type { Alphabet } from '../data/types';

export interface TranslitOptions {
  /** Younger: write o as ᚬ (óss, default) or ᚢ (úr). */
  oAs?: 'oss' | 'ur';
  /** Younger: write a word-final -r after a consonant as ᛦ. */
  finalR?: boolean;
  /** Write a double consonant once, as on most inscriptions. */
  singleDoubles?: boolean;
}

export interface TranslitStep {
  from: string;
  rune: string;
  note?: string;
}

/** Spec §2.3, the sound substitution table. Digraphs are matched first. */
const YOUNGER: Record<string, [string, string?]> = {
  th: ['ᚦ'], þ: ['ᚦ'], ð: ['ᚦ', 'ð also written ᚦ'], ng: ['ᚴ', 'ŋ written ᚴ'],
  a: ['ᛅ'], æ: ['ᛅ'], á: ['ᛅ'], b: ['ᛒ'], p: ['ᛒ', 'p written ᛒ (no p-rune)'],
  c: ['ᚴ'], k: ['ᚴ'], q: ['ᚴ'], g: ['ᚴ', 'g written ᚴ (no g-rune)'],
  d: ['ᛏ', 'd written ᛏ (no d-rune)'], t: ['ᛏ'],
  e: ['ᛁ', 'e written ᛁ (no e-rune)'], é: ['ᛁ'], i: ['ᛁ'], í: ['ᛁ'], j: ['ᛁ', 'j written ᛁ'],
  f: ['ᚠ'], h: ['ᚼ'], l: ['ᛚ'], m: ['ᛘ'], n: ['ᚾ'], r: ['ᚱ'], s: ['ᛋ'], z: ['ᛋ'],
  u: ['ᚢ'], ú: ['ᚢ'], v: ['ᚢ', 'v written ᚢ'], w: ['ᚢ', 'w written ᚢ'], y: ['ᚢ', 'y written ᚢ'],
  ý: ['ᚢ'], ø: ['ᚢ', 'ø written ᚢ'], ö: ['ᚢ', 'ö written ᚢ'], o: ['ᚬ'], ó: ['ᚬ'], å: ['ᚬ'],
  x: ['ᚴᛋ', 'x = ks'],
};

const ELDER: Record<string, [string, string?]> = {
  th: ['ᚦ'], þ: ['ᚦ'], ð: ['ᚦ'], ng: ['ᛜ'],
  a: ['ᚨ'], á: ['ᚨ'], å: ['ᚨ'], æ: ['ᛖ'], b: ['ᛒ'], c: ['ᚲ'], k: ['ᚲ'], q: ['ᚲ'], d: ['ᛞ'],
  e: ['ᛖ'], é: ['ᛖ'], f: ['ᚠ'], g: ['ᚷ'], h: ['ᚺ'], i: ['ᛁ'], í: ['ᛁ'], j: ['ᛃ'], l: ['ᛚ'],
  m: ['ᛗ'], n: ['ᚾ'], o: ['ᛟ'], ó: ['ᛟ'], ø: ['ᛟ'], ö: ['ᛟ'], p: ['ᛈ'], r: ['ᚱ'], s: ['ᛊ'],
  t: ['ᛏ'], u: ['ᚢ'], ú: ['ᚢ'], v: ['ᚹ'], w: ['ᚹ'], x: ['ᚲᛊ', 'x = ks'], y: ['ᛁ', 'y written ᛁ'],
  ý: ['ᛁ'], z: ['ᛉ'],
};

const SEP = '᛫';
const VOWELS = /[aeiouyáéíóúýæøöå]/;

export function transliterate(text: string, alphabet: Alphabet, opts: TranslitOptions = {}) {
  const table = alphabet === 'younger' ? YOUNGER : ELDER;
  const { oAs = 'oss', finalR = false, singleDoubles = true } = opts;
  const steps: TranslitStep[] = [];
  const words = text.toLowerCase().normalize('NFC').split(/[^\p{L}]+/u).filter(Boolean);
  const out: string[] = [];

  for (const word of words) {
    let w = '';
    let prevKey = '';
    for (let i = 0; i < word.length; ) {
      const two = word.slice(i, i + 2);
      const key = table[two] ? two : word[i];
      const hit = table[key];
      i += key.length;
      if (!hit) {
        steps.push({ from: key, rune: '', note: 'no runic equivalent, omitted' });
        continue;
      }
      let [rune, note] = hit;
      if (alphabet === 'younger' && (key === 'o' || key === 'ó') && oAs === 'ur') [rune, note] = ['ᚢ', 'o written ᚢ'];
      const atEnd = i >= word.length;
      if (alphabet === 'younger' && finalR && key === 'r' && atEnd && word.length > 1 && !VOWELS.test(word[word.length - 2])) {
        [rune, note] = ['ᛦ', 'final -R written ᛦ'];
      }
      const doubled = key === prevKey;
      prevKey = key;
      if (singleDoubles && doubled && !VOWELS.test(key)) {
        steps.push({ from: key, rune: '', note: 'double consonant written once' });
        continue;
      }
      w += rune;
      steps.push({ from: key, rune, note });
    }
    out.push(w);
  }
  return { runes: out.join(SEP), steps };
}
