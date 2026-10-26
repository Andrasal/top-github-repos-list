import { ALL_RUNES, INTENTS, STAVES } from '../data';
import type { Alphabet, Intent, Layer, Rune, Stave } from '../data/types';

/** Accent- and case-insensitive key (þ→th, ð→d, æ→ae, ø→o). */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/þ/g, 'th')
    .replace(/ð/g, 'd')
    .replace(/æ/g, 'ae')
    .replace(/[øǫ]/g, 'o')
    .normalize('NFD')
    .replace(/[̀-ͯ*]/g, '')
    .trim();
}

export type Hit =
  | { type: 'rune'; item: Rune; score: number; why: string }
  | { type: 'stave'; item: Stave; score: number; why: string };

export interface SearchFilters {
  alphabet?: Alphabet | 'all';
  layer?: Layer | 'all';
}

/** Ranked search over runes and staves (spec §7). */
export function search(query: string, filters: SearchFilters = {}): Hit[] {
  const q = query.trim();
  const nq = norm(q);
  const hits: Hit[] = [];
  const alphabet = filters.alphabet ?? 'all';
  const layer = filters.layer ?? 'all';

  for (const r of ALL_RUNES) {
    if (alphabet !== 'all' && r.alphabet !== alphabet) continue;
    const layers = r.magical.map((m) => m.layer);
    if (layer !== 'all' && !layers.includes(layer)) continue;
    if (!q) {
      hits.push({ type: 'rune', item: r, score: 0, why: '' });
      continue;
    }
    const s = scoreRune(r, q, nq);
    if (s) hits.push({ type: 'rune', item: r, ...s });
  }

  if (alphabet === 'all') {
    for (const st of STAVES) {
      if (layer !== 'all' && st.layer !== layer) continue;
      if (!q) {
        hits.push({ type: 'stave', item: st, score: 0, why: '' });
        continue;
      }
      const text = norm([st.name, st.translation, st.purpose, st.history, st.sources].join(' '));
      if (norm(st.name) === nq) hits.push({ type: 'stave', item: st, score: 90, why: 'name' });
      else if (text.includes(nq)) hits.push({ type: 'stave', item: st, score: 30, why: 'description' });
    }
  }
  return hits.sort((a, b) => b.score - a.score);
}

function scoreRune(r: Rune, q: string, nq: string): { score: number; why: string } | null {
  if (r.char === q || r.shortTwig === q) return { score: 100, why: 'rune' };
  if (norm(r.name) === nq) return { score: 90, why: 'name' };
  if (r.sounds.some((s) => norm(s) === nq)) return { score: 70, why: `sound /${q}/` };
  const kw = r.magical.find((m) => m.keywords.some((k) => norm(k) === nq || norm(k).startsWith(nq)));
  if (kw && nq.length >= 3) return { score: 60, why: `${kw.layer} meaning` };
  if (norm(r.name).startsWith(nq) && nq.length >= 2) return { score: 55, why: 'name' };
  if (nq.length >= 3 && norm(r.gloss).includes(nq)) return { score: 40, why: 'meaning' };
  const text = norm([r.history, ...r.poems.flatMap((p) => [p.original ?? '', p.translation]), ...r.magical.map((m) => m.note)].join(' '));
  if (nq.length >= 3 && text.includes(nq)) return { score: 20, why: 'history / poems' };
  return null;
}

/** Fuzzy intent lookup for the crafting engine (spec §4.1). */
export function findIntent(query: string): Intent | null {
  const nq = norm(query);
  if (!nq) return null;
  let best: { i: Intent; s: number } | null = null;
  for (const i of INTENTS) {
    const names = [i.id, i.label, ...i.synonyms].map(norm);
    let s = 0;
    for (const n of names) {
      if (n === nq) s = Math.max(s, 3);
      else if (n.startsWith(nq) || nq.startsWith(n)) s = Math.max(s, 2);
      else if (n.includes(nq) || nq.includes(n)) s = Math.max(s, 1);
    }
    if (s && (!best || s > best.s)) best = { i, s };
  }
  return best?.i ?? null;
}
