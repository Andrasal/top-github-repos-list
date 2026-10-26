/**
 * Recipe library — SPEC §23. Saved recipes are IMMUTABLE versions: saving never overwrites,
 * it appends a new entry linked to its parent. Editing an entry edits a copy (the draft).
 */
import type { Recipe } from './recipe';
import { DEFAULT_RECIPE, DEFAULT_SULFITE } from './recipe';
import { EMPTY_LOG } from './tracker';
import { FRUITS, HONEYS, SPICES, SUGARS, YEASTS } from './db';
import type { Protocol } from './nutrients';
import type { Analysis } from './recipe';
import { collectFlags } from './flags';

export interface LibraryEntry {
  id: string;
  /** Shared by every version of one recipe. */
  lineageId: string;
  /** The entry this one was copied from (null for a brand-new recipe). */
  parentId: string | null;
  version: number;
  name: string;
  author: 'you' | 'ai';
  /** What changed, in a sentence. */
  note: string;
  createdAt: string;
  recipe: Recipe;
}

export const newId = (prefix = 'r') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Fill any missing fields so old or AI-made recipes always analyse. */
export function normaliseRecipe(r: Partial<Recipe>): Recipe {
  return {
    ...DEFAULT_RECIPE,
    ...r,
    honeys: r.honeys ?? [],
    sugars: r.sugars ?? [],
    fruits: r.fruits ?? [],
    spices: r.spices ?? [],
    sulfite: { ...DEFAULT_SULFITE, ...(r.sulfite ?? {}) },
    log: { ...EMPTY_LOG, ...(r.log ?? {}) },
    adjustments: r.adjustments ?? [],
    alkalinityCaCO3: r.alkalinityCaCO3 ?? DEFAULT_RECIPE.alkalinityCaCO3,
  } as Recipe;
}

/** A brand-new recipe (new lineage, version 1). */
export function createEntry(recipe: Recipe, opts: { author: LibraryEntry['author']; note?: string; now?: Date }): LibraryEntry {
  const id = newId();
  return {
    id, lineageId: id, parentId: null, version: 1, name: recipe.name || 'Untitled mead',
    author: opts.author, note: opts.note ?? 'Created', createdAt: (opts.now ?? new Date()).toISOString(),
    recipe: structuredClone(normaliseRecipe(recipe)),
  };
}

/** A new version derived from `parent` — the parent is never modified. */
export function deriveEntry(parent: LibraryEntry, recipe: Recipe, all: LibraryEntry[], opts: { author: LibraryEntry['author']; note?: string; now?: Date }): LibraryEntry {
  const version = Math.max(0, ...all.filter((e) => e.lineageId === parent.lineageId).map((e) => e.version)) + 1;
  return {
    id: newId(), lineageId: parent.lineageId, parentId: parent.id, version,
    name: recipe.name || parent.name, author: opts.author, note: opts.note ?? 'Edited copy',
    createdAt: (opts.now ?? new Date()).toISOString(), recipe: structuredClone(normaliseRecipe(recipe)),
  };
}

export interface Lineage { lineageId: string; name: string; latest: LibraryEntry; versions: LibraryEntry[] }

/** Group entries into recipes (newest activity first), versions newest first. */
export function lineages(entries: LibraryEntry[]): Lineage[] {
  const map = new Map<string, LibraryEntry[]>();
  for (const e of entries) map.set(e.lineageId, [...(map.get(e.lineageId) ?? []), e]);
  return [...map.entries()]
    .map(([lineageId, vs]) => {
      const versions = vs.sort((a, b) => b.version - a.version);
      return { lineageId, name: versions[0].name, latest: versions[0], versions };
    })
    .sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt));
}

// ── AI-facing compact recipe spec (SPEC §24.2) ───────────────────────────────

export interface RecipeSpec {
  name?: string;
  volume_l?: number;
  honeys?: { id: string; kg: number }[];
  sugars?: { id: string; kg: number }[];
  fruits?: { id: string; kg: number; stage?: 'primary' | 'secondary' }[];
  botanicals?: { id: string; g: number }[];
  yeast_id?: string;
  target_fg?: number | null;
  nutrient_protocol?: Protocol;
  water_alkalinity?: number;
  additions?: { id: string; g: number; stage?: 'must' | 'finished' }[];
}

const IDS = {
  honey: new Set(HONEYS.map((x) => x.id)),
  sugar: new Set(SUGARS.map((x) => x.id as string)),
  fruit: new Set(FRUITS.map((x) => x.id)),
  botanical: new Set(SPICES.map((x) => x.id)),
  yeast: new Set(YEASTS.map((x) => x.id)),
  addition: new Set(['tartaric', 'malic', 'citric', 'lactic', 'kBicarb', 'kCarb', 'caCarb']),
};
const PROTOCOLS = new Set(['tosna3', 'kDap', 'oK']);

function num(v: unknown, what: string, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${what} must be a number`);
  if (n < min || n > max) throw new Error(`${what} = ${n} is outside ${min}–${max}`);
  return n;
}
function checkId(kind: keyof typeof IDS, id: unknown): string {
  const s = String(id);
  if (!IDS[kind].has(s)) throw new Error(`Unknown ${kind} id "${s}". Valid: ${[...IDS[kind]].join(', ')}`);
  return s;
}

let seq = 0;
const u = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Apply a (partial) spec on top of `base`. Throws a readable error for anything invalid — the AI sees it and corrects. */
export function applySpec(base: Recipe, spec: RecipeSpec): Recipe {
  const r = normaliseRecipe(structuredClone(base));
  if (spec.name != null) r.name = String(spec.name).slice(0, 80);
  if (spec.volume_l != null) { r.mode = 'targetVolume'; r.targetVolumeL = num(spec.volume_l, 'volume_l', 0.5, 2000); }
  if (spec.honeys) r.honeys = spec.honeys.map((h) => ({ uid: u('h'), honeyId: checkId('honey', h.id), massKg: num(h.kg, `honey ${h.id} kg`, 0, 1000) }));
  if (spec.sugars) r.sugars = spec.sugars.map((g) => ({ uid: u('g'), sugarId: checkId('sugar', g.id) as Recipe['sugars'][number]['sugarId'], massKg: num(g.kg, `sugar ${g.id} kg`, 0, 1000) }));
  if (spec.fruits) r.fruits = spec.fruits.map((f) => ({ uid: u('f'), fruitId: checkId('fruit', f.id), massKg: num(f.kg, `fruit ${f.id} kg`, 0, 2000), stage: f.stage === 'secondary' ? 'secondary' : 'primary' }));
  if (spec.botanicals) r.spices = spec.botanicals.map((s) => ({ uid: u('s'), spiceId: checkId('botanical', s.id), grams: num(s.g, `botanical ${s.id} g`, 0, 100000) }));
  if (spec.yeast_id != null) r.yeastId = checkId('yeast', spec.yeast_id);
  if (spec.target_fg !== undefined) r.targetFg = spec.target_fg == null ? null : num(spec.target_fg, 'target_fg', 0.99, 1.1);
  if (spec.nutrient_protocol != null) {
    if (!PROTOCOLS.has(spec.nutrient_protocol)) throw new Error('nutrient_protocol must be tosna3, kDap or oK');
    r.protocol = spec.nutrient_protocol;
  }
  if (spec.water_alkalinity != null) r.alkalinityCaCO3 = num(spec.water_alkalinity, 'water_alkalinity', 0, 500);
  if (spec.additions) r.adjustments = spec.additions.map((a) => ({ uid: u('a'), id: checkId('addition', a.id) as Recipe['adjustments'][number]['id'], grams: num(a.g, `addition ${a.id} g`, 0, 10000), stage: a.stage === 'must' ? 'must' : 'finished' }));
  if (r.honeys.length + r.sugars.length + r.fruits.length === 0) throw new Error('A recipe needs at least one honey, sugar or fruit');
  return r;
}

/** The compact spec form of a recipe (what the AI reads). */
export function toSpec(r: Recipe): Required<Omit<RecipeSpec, 'target_fg'>> & { target_fg: number | null } {
  return {
    name: r.name,
    volume_l: Number((r.mode === 'targetVolume' ? r.targetVolumeL : r.waterL).toFixed(3)),
    honeys: r.honeys.map((h) => ({ id: h.honeyId, kg: h.massKg })),
    sugars: r.sugars.map((g) => ({ id: g.sugarId, kg: g.massKg })),
    fruits: r.fruits.map((f) => ({ id: f.fruitId, kg: f.massKg, stage: f.stage })),
    botanicals: r.spices.map((s) => ({ id: s.spiceId, g: s.grams })),
    yeast_id: r.yeastId,
    target_fg: r.targetFg,
    nutrient_protocol: r.protocol,
    water_alkalinity: r.alkalinityCaCO3,
    additions: (r.adjustments ?? []).map((a) => ({ id: a.id, g: a.grams, stage: a.stage })),
  };
}

/** Small numeric summary for lists and for the AI (keep tool results small). */
export function summarise(a: Analysis) {
  const flags = collectFlags(a.advisories);
  return {
    og: Number(a.og.toFixed(3)),
    fg: Number(a.fg.fg.toFixed(3)),
    abv: Number(a.abv.toFixed(1)),
    sweetness: a.sweetness,
    strength: a.strength,
    finished_ph: Number(a.ph.finishedPh.toFixed(2)),
    ta_g_per_l: Number(a.ph.finishedTa.toFixed(1)),
    water_to_add_l: Number(a.primary.waterL.toFixed(2)),
    colour: a.color.name,
    tasting_note: a.tastingNote,
    flags: flags.map((f) => `${f.severity}: ${f.title}`),
  };
}
