/**
 * AI recipe assistant — SPEC §24. Tools run through Claude (artifact `sample` or own key) or any other connected AI (§25).
 * Every change the AI makes is saved as a NEW library entry; existing entries are never modified.
 */
import { analyzeRecipe, DEFAULT_RECIPE, Recipe } from './recipe';
import { applySpec, createEntry, deriveEntry, LibraryEntry, RecipeSpec, summarise, toSpec } from './library';
import { FRUITS, HONEYS, SPICES, SUGARS, YEASTS } from './db';
import type { UnitSystem } from './units';

export interface ChatTool {
  name: string;
  description: string;
  inputSchema?: { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
  execute(input: Record<string, unknown>, context?: { signal?: AbortSignal }): unknown;
}

export type ChatEvent =
  | { kind: 'status'; text: string }
  | { kind: 'saved'; entry: LibraryEntry; parent: LibraryEntry | null; abv: number };

export interface ToolContext {
  entries(): LibraryEntry[];
  draft(): { recipe: Recipe; baseId: string | null };
  save(entry: LibraryEntry): Promise<void>;
  emit(e: ChatEvent): void;
}

const SPEC_SCHEMA = {
  type: 'object',
  description: 'Recipe fields in metric units. Omitted fields are kept from the base recipe.',
  properties: {
    name: { type: 'string' },
    volume_l: { type: 'number', description: 'Must volume in litres (after fruit juice is released)' },
    honeys: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, kg: { type: 'number' } }, required: ['id', 'kg'] } },
    sugars: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, kg: { type: 'number' } }, required: ['id', 'kg'] } },
    fruits: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, kg: { type: 'number' }, stage: { type: 'string', enum: ['primary', 'secondary'] } }, required: ['id', 'kg'] } },
    botanicals: { type: 'array', description: 'Spices, flowers, herbs, oak etc. in grams for the whole batch', items: { type: 'object', properties: { id: { type: 'string' }, g: { type: 'number' } }, required: ['id', 'g'] } },
    yeast_id: { type: 'string' },
    target_fg: { type: 'number', description: 'Stop/back-sweeten finish gravity, e.g. 1.012. Use 0 to remove the target (ferment to the yeast limit or dry).' },
    nutrient_protocol: { type: 'string', enum: ['tosna3', 'kDap', 'oK'] },
    water_alkalinity: { type: 'number', description: 'mg/L as CaCO3: 0 RO, 50 spring, 100 tap, 250 hard' },
    additions: { type: 'array', description: 'Acid or buffer additions', items: { type: 'object', properties: { id: { type: 'string', enum: ['tartaric', 'malic', 'citric', 'lactic', 'kBicarb', 'kCarb', 'caCarb'] }, g: { type: 'number' }, stage: { type: 'string', enum: ['must', 'finished'] } }, required: ['id', 'g'] } },
  },
};

const resolveBase = (ctx: ToolContext, id: unknown): { recipe: Recipe; entry: LibraryEntry | null; label: string } => {
  const key = id == null || id === '' ? 'draft' : String(id);
  if (key === 'draft') {
    const d = ctx.draft();
    return { recipe: d.recipe, entry: ctx.entries().find((e) => e.id === d.baseId) ?? null, label: 'the recipe open in the editor' };
  }
  const e = ctx.entries().find((x) => x.id === key);
  if (!e) throw new Error(`No saved recipe with id "${key}". Call list_recipes for valid ids, or use "draft".`);
  return { recipe: e.recipe, entry: e, label: `${e.name} v${e.version}` };
};

export function makeTools(ctx: ToolContext): ChatTool[] {
  return [
    {
      name: 'list_recipes',
      description: 'List the user\'s saved recipes (latest versions first) with id, version, ABV and a one-line note. Use to find a recipe the user refers to by name.',
      // Some providers (Gemini) reject tools whose parameters are an empty object
      inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'How many recipes to return (default 40)' } } },
      execute(input) {
        ctx.emit({ kind: 'status', text: 'Looking through your recipes…' });
        return ctx.entries()
          .slice()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, Math.max(1, Math.min(100, Number(input?.limit) || 40)))
          .map((e) => {
            const a = analyzeRecipe(e.recipe);
            return { id: e.id, name: e.name, version: e.version, by: e.author, saved: e.createdAt.slice(0, 10), note: e.note, abv: Number(a.abv.toFixed(1)), sweetness: a.sweetness };
          });
      },
    },
    {
      name: 'get_recipe',
      description: 'Read one recipe in full (ingredients as a spec plus computed OG, FG, ABV, pH, flags). id = a saved recipe id, or "draft" for the recipe currently open in the editor.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      execute(input) {
        const b = resolveBase(ctx, input.id);
        ctx.emit({ kind: 'status', text: `Reading ${b.label}…` });
        return { id: b.entry?.id ?? 'draft', version: b.entry?.version ?? null, spec: toSpec(b.recipe), computed: summarise(analyzeRecipe(b.recipe)) };
      },
    },
    {
      name: 'analyze_recipe',
      description: 'Dry run: apply changes to a base recipe (or start from scratch with base_id "new") and return the computed numbers WITHOUT saving. Use it to check OG, ABV, pH and flags before saving.',
      inputSchema: { type: 'object', properties: { base_id: { type: 'string', description: 'saved id, "draft", or "new"' }, changes: SPEC_SCHEMA }, required: ['changes'] },
      execute(input) {
        ctx.emit({ kind: 'status', text: 'Running the numbers…' });
        const base = input.base_id === 'new' ? { ...DEFAULT_RECIPE, honeys: [], fruits: [], spices: [], sugars: [] } : resolveBase(ctx, input.base_id).recipe;
        const r = applySpec(base, (input.changes ?? {}) as RecipeSpec);
        return { spec: toSpec(r), computed: summarise(analyzeRecipe(r)) };
      },
    },
    {
      name: 'create_recipe',
      description: 'Save a brand-new recipe to the library as version 1. Give a short name and a one-sentence note. Returns the new id and its computed numbers.',
      inputSchema: { type: 'object', properties: { note: { type: 'string' }, recipe: { ...SPEC_SCHEMA, required: ['name'] } }, required: ['recipe', 'note'] },
      async execute(input, context) {
        const spec = (input.recipe ?? {}) as RecipeSpec;
        const r = applySpec({ ...DEFAULT_RECIPE, honeys: [], fruits: [], spices: [], sugars: [], targetFg: null, name: String(spec.name ?? 'New mead') }, spec);
        if (context?.signal?.aborted) throw new Error('Stopped by the user');
        const entry = createEntry(r, { author: 'ai', note: String(input.note ?? 'Created by the assistant') });
        await ctx.save(entry);
        const a = analyzeRecipe(r);
        ctx.emit({ kind: 'saved', entry, parent: null, abv: a.abv });
        return { saved: true, id: entry.id, name: entry.name, version: 1, computed: summarise(a) };
      },
    },
    {
      name: 'edit_recipe',
      description: 'Save an edited COPY of a recipe as its next version. The original is never changed. base_id = saved id or "draft". changes = only the fields to replace (arrays replace whole lists). Give a one-sentence note of what changed.',
      inputSchema: { type: 'object', properties: { base_id: { type: 'string' }, note: { type: 'string' }, changes: SPEC_SCHEMA }, required: ['base_id', 'changes', 'note'] },
      async execute(input, context) {
        const b = resolveBase(ctx, input.base_id);
        const r = applySpec(b.recipe, (input.changes ?? {}) as RecipeSpec);
        if (context?.signal?.aborted) throw new Error('Stopped by the user');
        const note = String(input.note ?? 'Edited by the assistant');
        const entry = b.entry ? deriveEntry(b.entry, r, ctx.entries(), { author: 'ai', note }) : createEntry(r, { author: 'ai', note });
        await ctx.save(entry);
        const a = analyzeRecipe(r);
        ctx.emit({ kind: 'saved', entry, parent: b.entry, abv: a.abv });
        return { saved: true, id: entry.id, name: entry.name, version: entry.version, copied_from: b.entry ? `${b.entry.name} v${b.entry.version}` : 'editor draft', computed: summarise(a) };
      },
    },
  ];
}

/** Catalog of valid ids with the numbers the AI needs to dose sensibly (kept compact). */
/** SPEC §24.3 — fallback when page tools can't run: Claude returns one JSON action that the page applies itself. */
export interface JsonAction {
  reply: string;
  action: 'none' | 'create' | 'edit';
  base_id?: string | null;
  note?: string;
  changes?: RecipeSpec;
}

export const JSON_MODE_RULES = [
  '',
  'TOOLS ARE NOT AVAILABLE IN THIS VIEW. Instead, answer with ONE JSON object and nothing else:',
  '{"reply": "<your short answer to the user>", "action": "none" | "create" | "edit", "base_id": "<saved id or \"draft\">", "note": "<one sentence: what changed>", "changes": { ...recipe fields... }}',
  '- action "none" for questions; "create" for a brand-new recipe (changes = the full recipe incl. name, volume_l, honeys); "edit" to save an edited copy of base_id (changes = only the fields to replace; arrays replace whole lists).',
  '- Recipe fields: name, volume_l, honeys [{id,kg}], sugars [{id,kg}], fruits [{id,kg,stage}], botanicals [{id,g}], yeast_id, target_fg (0 = none), nutrient_protocol (tosna3|kDap|oK), water_alkalinity, additions [{id,g,stage}]. Metric, catalog ids only.',
  '- The app computes OG, ABV and pH itself after saving, so do not quote numbers you have not seen. Say what you changed.',
].join('\n');

/** Validate a JSON-mode answer; returns a normalised action or throws a readable error. */
export function parseJsonAction(v: unknown): JsonAction {
  if (!v || typeof v !== 'object') throw new Error('Reply was not a JSON object');
  const o = v as Record<string, unknown>;
  const action = o.action === 'create' || o.action === 'edit' ? o.action : 'none';
  return {
    reply: typeof o.reply === 'string' ? o.reply : '',
    action,
    base_id: typeof o.base_id === 'string' ? o.base_id : 'draft',
    note: typeof o.note === 'string' ? o.note : undefined,
    changes: o.changes && typeof o.changes === 'object' ? (o.changes as RecipeSpec) : undefined,
  };
}

export function catalog(): string {
  const h = HONEYS.map((x) => `${x.id} (${x.name}, intensity ${x.intensity}/3)`).join('; ');
  const f = FRUITS.map((x) => `${x.id} (${x.name}; typical ${x.typical} kg/L, max ${x.max}; juice pH ${x.ph})`).join('; ');
  const s = SPICES.map((x) => `${x.id} (${x.name}, ${x.group}; typical ${x.typical} g/L, max ${x.max})`).join('; ');
  const y = YEASTS.map((x) => `${x.id} (${x.name}, ${x.tolerance}% tol., N ${x.nDemand})`).join('; ');
  const g = SUGARS.map((x) => x.id).join(', ');
  return `HONEYS: ${h}\nFRUITS: ${f}\nBOTANICALS: ${s}\nYEASTS: ${y}\nSUGARS: ${g}\nADDITIONS: tartaric, malic, citric, lactic (acids); kBicarb, kCarb, caCarb (raise pH)`;
}

export function instructions(draft: Recipe, baseLabel: string | null, units: UnitSystem): string {
  const a = analyzeRecipe(draft);
  return [
    'You are the recipe assistant inside Mead Lab, a meadmaking app. Help the user design new meads and improve existing ones.',
    'RULES:',
    '- Saved recipes are never overwritten. To change one, call edit_recipe: it saves a new version and keeps the old one. For a new idea, call create_recipe. Only save when the user asks for a recipe or a change, not for plain questions.',
    '- Before saving, check the numbers with analyze_recipe and fix any "error" flags. Keep each fruit and botanical between its typical and bold dose unless the user asks for more.',
    '- Use only ids from the catalog. Tool quantities are metric (kg, g, litres for the whole batch).',
    `- The user works in ${units === 'imperial' ? 'US gallons and pounds: convert when you talk to them (1 gal = 3.785 L, 1 lb = 0.4536 kg)' : 'litres and kilograms'}.`,
    '- If the batch size is not given, use the size of the recipe in the editor. State any assumption in one line instead of asking, unless the request is truly unclear.',
    '- Reply briefly (the user is often on a phone): say what you made or changed in a few bullets with OG, ABV, finish and pH, and name the version you saved. No tables.',
    '- ABV is always from the app\'s Alternative ABV equation, so quote the tools\' numbers, never your own estimates.',
    '',
    `RECIPE OPEN IN THE EDITOR (id "draft"${baseLabel ? `, a copy of ${baseLabel}` : ', not saved yet'}):`,
    JSON.stringify({ spec: toSpec(draft), computed: summarise(a) }),
    '',
    'CATALOG:',
    catalog(),
  ].join('\n');
}
