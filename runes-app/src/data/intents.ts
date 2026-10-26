import type { Intent } from './types';

/**
 * Desired effect → candidate runes (spec §4.1). Order matters: the first runes
 * are the strongest candidates. Rune ids refer to src/data/{elder,younger}.ts.
 */
export const INTENTS: Intent[] = [
  {
    id: 'victory', label: 'Victory', synonyms: ['win', 'triumph', 'success in battle', 'battle', 'competition'],
    elder: ['elder-tiwaz', 'elder-sowilo'], younger: ['younger-tyr', 'younger-sol'],
    rationale: 'Sigrdrífumál st. 6 names Týr for victory-runes carved on the sword-hilt.', layer: 'literary',
  },
  {
    id: 'courage', label: 'Courage', synonyms: ['bravery', 'strength', 'valor', 'valour', 'fearless', 'confidence'],
    elder: ['elder-uruz', 'elder-tiwaz', 'elder-thurisaz'], younger: ['younger-ur', 'younger-tyr', 'younger-thurs'],
    rationale: 'The aurochs (ᚢ) and Týr (ᛏ) stand for strength and resolve. This is a modern association built on the poems.', layer: 'modern',
  },
  {
    id: 'protection', label: 'Protection', synonyms: ['safety', 'ward', 'warding', 'guard', 'defense', 'defence', 'shield'],
    elder: ['elder-algiz', 'elder-thurisaz', 'elder-eihwaz'], younger: ['younger-madr', 'younger-thurs', 'younger-yr'],
    rationale: 'The ᛉ/ᛘ "protection" reading is 20th-c. The þurs-rune as a weapon is literary (Skírnismál).', layer: 'modern',
  },
  {
    id: 'wealth', label: 'Wealth', synonyms: ['money', 'prosperity', 'abundance', 'riches', 'business', 'trade'],
    elder: ['elder-fehu', 'elder-jera', 'elder-othala'], younger: ['younger-fe', 'younger-ar'],
    rationale: 'This follows the literal meanings of fé "wealth" and ár "good year". Note that the Norse poems warn about wealth.', layer: 'modern',
  },
  {
    id: 'love', label: 'Love', synonyms: ['partnership', 'romance', 'relationship', 'friendship', 'union'],
    elder: ['elder-gebo', 'elder-wunjo', 'elder-ingwaz'], younger: ['younger-madr', 'younger-bjarkan'],
    rationale: 'Gift-exchange (ᚷ) and joy (ᚹ) are modern readings. The Younger row lacks both, so its picks are a compromise.', layer: 'modern',
  },
  {
    id: 'healing', label: 'Healing', synonyms: ['health', 'recovery', 'vitality', 'wellness', 'cure'],
    elder: ['elder-uruz', 'elder-sowilo', 'elder-laguz', 'elder-berkanan'], younger: ['younger-ur', 'younger-sol', 'younger-logr'],
    rationale: 'This is a modern reading. Note that Egils saga ch. 72 warns that mis-carved runes cause illness.', layer: 'modern',
  },
  {
    id: 'travel', label: 'Safe travel', synonyms: ['journey', 'way', 'navigation', 'direction', 'road', 'voyage'],
    elder: ['elder-raido', 'elder-ehwaz', 'elder-laguz'], younger: ['younger-reid', 'younger-logr'],
    rationale: 'Riding (ᚱ), the horse (ᛖ) and water (ᛚ) follow the literal names. For a stave, see Vegvísir.', layer: 'modern',
  },
  {
    id: 'wisdom', label: 'Wisdom', synonyms: ['knowledge', 'eloquence', 'insight', 'learning', 'speech', 'inspiration'],
    elder: ['elder-ansuz', 'elder-kaunan', 'elder-mannaz'], younger: ['younger-oss', 'younger-kaun'],
    rationale: 'The Icelandic poem makes óss Odin, and the Old English poem makes ᚨ "mouth" and ᚲ "torch".', layer: 'modern',
  },
  {
    id: 'fertility', label: 'Fertility & growth', synonyms: ['growth', 'birth', 'pregnancy', 'harvest', 'garden'],
    elder: ['elder-berkanan', 'elder-ingwaz', 'elder-jera'], younger: ['younger-bjarkan', 'younger-ar'],
    rationale: 'This follows birch (ᛒ), Ing/Freyr (ᛜ) and the good year (ᛃ/ᛅ).', layer: 'modern',
  },
  {
    id: 'clarity', label: 'Clarity & focus', synonyms: ['focus', 'concentration', 'calm', 'breakthrough', 'awakening'],
    elder: ['elder-dagaz', 'elder-isaz', 'elder-sowilo'], younger: ['younger-isa', 'younger-sol'],
    rationale: 'This follows day (ᛞ), ice-stillness (ᛁ) and the sun (ᛊ/ᛋ).', layer: 'modern',
  },
  {
    id: 'home', label: 'Home & family', synonyms: ['family', 'heritage', 'ancestry', 'house', 'belonging'],
    elder: ['elder-othala', 'elder-wunjo', 'elder-mannaz'], younger: ['younger-madr', 'younger-ar'],
    rationale: 'Inherited land (ᛟ) and joy (ᚹ). The Younger row has no ᛟ.', layer: 'modern',
  },
  {
    id: 'luck', label: 'Luck', synonyms: ['fortune', 'chance', 'good luck', 'blessing'],
    elder: ['elder-gebo', 'elder-ansuz', 'elder-laguz'], younger: ['younger-oss', 'younger-ar'],
    rationale: 'The ᚷ is from the attested formula gibu auja ("I give luck"), and ᚨᛚᚢ (alu) is an attested charm word.', layer: 'attested',
  },
];

/**
 * Modern-convention conflict pairs (spec A13). These only produce warnings.
 * Keys are rune *shape* names so they apply across alphabets.
 */
export const CONFLICTS: { a: string[]; b: string[]; reason: string }[] = [
  { a: ['ᛁ'], b: ['ᚱ', 'ᛖ'], reason: 'Stillness (ice) works against movement (riding / horse).' },
  { a: ['ᚺ', 'ᚼ'], b: ['ᚹ'], reason: 'Disruption (hail) works against joy and harmony.' },
  { a: ['ᚾ'], b: ['ᚠ', 'ᛃ', 'ᛅ'], reason: 'Constraint (need) works against the flow of wealth and harvest.' },
];
