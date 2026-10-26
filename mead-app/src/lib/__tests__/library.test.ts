import { describe, expect, it } from 'vitest';
import { applySpec, createEntry, deriveEntry, LibraryEntry, lineages, toSpec } from '../library';
import { analyzeRecipe, DEFAULT_RECIPE } from '../recipe';
import { instructions, makeTools, ChatEvent } from '../chat';
import { localStore, openStore } from '../store';

describe('immutable library (SPEC §23)', () => {
  it('deriving a version never touches the parent and numbers versions per lineage', () => {
    const v1 = createEntry(DEFAULT_RECIPE, { author: 'you' });
    const before = JSON.stringify(v1);
    const edited = { ...v1.recipe, honeys: [{ ...v1.recipe.honeys[0], massKg: 4 }] };
    const v2 = deriveEntry(v1, edited, [v1], { author: 'you', note: 'more honey' });
    const v3 = deriveEntry(v2, v2.recipe, [v1, v2], { author: 'ai' });
    expect(JSON.stringify(v1)).toBe(before);
    expect([v1.version, v2.version, v3.version]).toEqual([1, 2, 3]);
    expect(v2.parentId).toBe(v1.id);
    expect(v3.lineageId).toBe(v1.lineageId);
    expect(v2.recipe.honeys[0].massKg).toBe(4);
    expect(v1.recipe.honeys[0].massKg).toBe(DEFAULT_RECIPE.honeys[0].massKg);
    // deep copy: mutating the source object after saving cannot leak into the entry
    edited.honeys[0].massKg = 99;
    expect(v2.recipe.honeys[0].massKg).toBe(4);
  });
  it('groups lineages, newest version first', () => {
    const a1 = createEntry(DEFAULT_RECIPE, { author: 'you', now: new Date('2026-01-01') });
    const a2 = deriveEntry(a1, a1.recipe, [a1], { author: 'ai', now: new Date('2026-01-03') });
    const b1 = createEntry({ ...DEFAULT_RECIPE, name: 'Other' }, { author: 'you', now: new Date('2026-01-02') });
    const ls = lineages([a1, b1, a2]);
    expect(ls.map((l) => l.name)).toEqual([DEFAULT_RECIPE.name, 'Other']);
    expect(ls[0].versions.map((v) => v.version)).toEqual([2, 1]);
  });
  it('spec round-trips and rejects unknown ids with a helpful message', () => {
    const r = applySpec(DEFAULT_RECIPE, toSpec(DEFAULT_RECIPE));
    expect(analyzeRecipe(r).og).toBeCloseTo(analyzeRecipe(DEFAULT_RECIPE).og, 8);
    expect(() => applySpec(DEFAULT_RECIPE, { fruits: [{ id: 'dragonfruit', kg: 1 }] })).toThrow(/Unknown fruit id "dragonfruit". Valid: strawberry/);
    expect(() => applySpec(DEFAULT_RECIPE, { honeys: [], fruits: [], sugars: [] })).toThrow(/at least one/);
  });
  it('local store persists and notifies', async () => {
    const mem = new Map<string, string>();
    const s = localStore({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) });
    let seen: LibraryEntry[] = [];
    s.subscribe((e) => (seen = e));
    await s.put(createEntry(DEFAULT_RECIPE, { author: 'you' }));
    expect(seen).toHaveLength(1);
    expect(JSON.parse(mem.get('mead-lab:library:v1')!)).toHaveLength(1);
  });
});

describe('cloud store path grammar (SPEC §23.2)', () => {
  it('uses valid collection/document paths and writes through db', async () => {
    // Fake db that enforces the real runtime's parity rules (doc = even segments, collection = odd)
    const writes: string[] = [];
    const segs = (p: string) => p.split('/').length;
    const coll = (path: string) => {
      if (segs(path) % 2 !== 1) throw new TypeError(`collection path needs odd segments: ${path}`);
      return {
        doc: (id: string) => ({ set: async () => void writes.push(`${path}/${id}`), delete: async () => {} }),
        onSnapshot: (next: (s: { docs: never[] }) => void) => { next({ docs: [] }); return () => {}; },
      };
    };
    const db = { doc: (path: string) => { if (segs(path) % 2 !== 0) throw new TypeError(`doc path needs even segments: ${path}`); return { collection: (c: string) => coll(`${path}/${c}`) }; } };
    const rt = { use: async (n: string) => (n === 'db' ? db : n === 'user' ? { id: async () => 'u_test' } : null) };
    const store = await openStore(rt);
    expect(store.kind).toBe('cloud');
    await store.put(createEntry(DEFAULT_RECIPE, { author: 'you' }));
    expect(writes[0]).toMatch(/^data\/users\/u_test\/meadlab\/recipes\/r-/);
  });
  it('falls back to local when there is no signed-in user', async () => {
    const store = await openStore({ use: async () => null });
    expect(store.kind).toBe('local');
  });
});

describe('AI tools (SPEC §24)', () => {
  const setup = () => {
    const saved: LibraryEntry[] = [];
    const events: ChatEvent[] = [];
    const base = createEntry(DEFAULT_RECIPE, { author: 'you' });
    saved.push(base);
    const tools = makeTools({
      entries: () => saved,
      draft: () => ({ recipe: base.recipe, baseId: base.id }),
      save: async (e) => void saved.push(e),
      emit: (e) => events.push(e),
    });
    const tool = (n: string) => tools.find((t) => t.name === n)!;
    return { saved, events, base, tool };
  };
  it('edit_recipe saves a new version and leaves the original intact', async () => {
    const { saved, base, tool, events } = setup();
    const before = JSON.stringify(base);
    const res = (await tool('edit_recipe').execute({ base_id: base.id, note: 'Swap to raspberry', changes: { fruits: [{ id: 'raspberry', kg: 1.8 }] } })) as { version: number; computed: { abv: number } };
    expect(res.version).toBe(2);
    expect(saved).toHaveLength(2);
    expect(JSON.stringify(base)).toBe(before);
    expect(saved[1].recipe.fruits[0].fruitId).toBe('raspberry');
    expect(saved[1].author).toBe('ai');
    expect(events.some((e) => e.kind === 'saved')).toBe(true);
  });
  it('edit of "draft" derives from the draft\'s saved base', async () => {
    const { saved, tool } = setup();
    await tool('edit_recipe').execute({ base_id: 'draft', note: 'x', changes: { name: 'Draft copy' } });
    expect(saved[1].parentId).toBe(saved[0].id);
  });
  it('create_recipe starts a new lineage; analyze_recipe saves nothing', async () => {
    const { saved, tool } = setup();
    const dry = (await tool('analyze_recipe').execute({ base_id: 'new', changes: { name: 'T', volume_l: 19, honeys: [{ id: 'clover', kg: 6 }] } })) as { computed: { og: number } };
    expect(dry.computed.og).toBeGreaterThan(1.09);
    expect(saved).toHaveLength(1);
    const made = (await tool('create_recipe').execute({ note: 'new', recipe: { name: 'Cyser', volume_l: 10, honeys: [{ id: 'wildflower', kg: 2 }], fruits: [{ id: 'apple-juice', kg: 5 }] } })) as { version: number };
    expect(made.version).toBe(1);
    expect(saved[1].lineageId).not.toBe(saved[0].lineageId);
  });
  it('errors are thrown as readable messages (the AI sees and corrects them)', async () => {
    const { tool } = setup();
    expect(() => tool('get_recipe').execute({ id: 'nope' })).toThrow(/list_recipes/);
  });
  it('instructions stay compact and include the catalog and rules', () => {
    const text = instructions(DEFAULT_RECIPE, null, 'metric');
    expect(text).toMatch(/never overwritten/);
    expect(text).toMatch(/elderflower/);
    expect(new TextEncoder().encode(text).length).toBeLessThan(16_000);
  });
});
