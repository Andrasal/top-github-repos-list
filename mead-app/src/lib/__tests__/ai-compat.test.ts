import { describe, expect, it } from 'vitest';
import { makeTools } from '../chat';
import type { LibraryEntry } from '../library';
import { DEFAULT_RECIPE } from '../recipe';
import { compatJson, extractJson, listCompatModels, runCompatChat } from '../ai/openai-compat';
import { chatModels, pickModel, preset, PROVIDERS } from '../ai/providers';

type Reply = { status?: number; body: unknown };
function fakeFetch(script: Reply[]) {
  const calls: { url: string; init: RequestInit; body: Record<string, unknown> | null }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init, body: init.body ? JSON.parse(String(init.body)) : null });
    const r = script.shift();
    if (!r) throw new TypeError('Failed to fetch');
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { f, calls };
}
const reply = (message: Record<string, unknown>, finish = 'stop') => ({ body: { choices: [{ message: { role: 'assistant', ...message }, finish_reason: finish }] } });

function lib() {
  const entries: LibraryEntry[] = [];
  const tools = makeTools({ entries: () => entries, draft: () => ({ recipe: DEFAULT_RECIPE, baseId: null }), save: async (e) => { entries.push(e); }, emit: () => {} });
  return { tools, entries };
}
const cfg = (f: typeof fetch) => ({ baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', apiKey: 'AIzaTEST', model: 'gemini-3.8-flash', fetch: f });

describe('provider presets', () => {
  it('every tool schema has parameters (Gemini rejects empty ones)', () => {
    for (const t of lib().tools) expect(Object.keys((t.inputSchema?.properties ?? {}) as object).length).toBeGreaterThan(0);
  });
  it('picks a free Flash model for Gemini and skips non-chat models', () => {
    const ids = ['models/gemini-3.8-flash', 'models/gemini-3.8-flash-lite', 'models/gemini-3.1-pro-preview', 'models/text-embedding-005', 'models/gemini-3.5-flash', 'models/imagen-4', 'models/gemini-3.9-flash-preview'];
    expect(chatModels(ids)).not.toContain('text-embedding-005');
    expect(chatModels(ids)).not.toContain('imagen-4');
    expect(pickModel(ids, preset('gemini'))).toBe('gemini-3.8-flash');
  });
  it('prefers the free router on OpenRouter', () => {
    expect(pickModel(['anthropic/claude-sonnet-5.5', 'openrouter/free', 'nvidia/nemotron-3-ultra:free'], preset('openrouter'))).toBe('openrouter/free');
    expect(pickModel(['anthropic/claude-sonnet-5.5', 'nvidia/nemotron-3-ultra:free'], preset('openrouter'))).toBe('nvidia/nemotron-3-ultra:free');
  });
  it('lists free options first-class', () => {
    expect(PROVIDERS[0].id).toBe('gemini');
    expect(PROVIDERS.filter((p) => p.free).map((p) => p.id)).toEqual(expect.arrayContaining(['gemini', 'openrouter', 'ollama']));
  });
});

describe('listCompatModels', () => {
  it('strips the models/ prefix and sends the key as a Bearer token', async () => {
    const { f, calls } = fakeFetch([{ body: { data: [{ id: 'models/gemini-3.8-flash' }] } }]);
    expect(await listCompatModels({ baseUrl: 'https://x.test/v1/', apiKey: 'k1', fetch: f })).toEqual(['gemini-3.8-flash']);
    expect(calls[0].url).toBe('https://x.test/v1/models');
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer k1');
  });
  it('treats a 400 on the model list as a bad key (Gemini’s way of saying so)', async () => {
    const { f } = fakeFetch([{ status: 400, body: [{ error: { code: 400, message: 'API key not valid', status: 'INVALID_ARGUMENT' } }] }]);
    await expect(listCompatModels({ baseUrl: 'https://x.test', apiKey: 'bad', fetch: f })).rejects.toMatchObject({ code: 'bad_key', message: 'API key not valid' });
  });
  it('reports a blocked or unreachable address as a network error', async () => {
    const { f } = fakeFetch([]);
    await expect(listCompatModels({ baseUrl: 'http://localhost:11434/v1', fetch: f })).rejects.toMatchObject({ code: 'network' });
  });
});

describe('runCompatChat', () => {
  it('runs an edit_recipe tool call and feeds the result back', async () => {
    const { tools, entries } = lib();
    const args = JSON.stringify({ base_id: 'draft', note: 'Raspberry', changes: { fruits: [{ id: 'raspberry', kg: 1.8 }] } });
    const { f, calls } = fakeFetch([
      reply({ content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'edit_recipe', arguments: args }, extra_content: { google: { thought_signature: 'sig' } } }] }, 'tool_calls'),
      reply({ content: '<think>hmm</think>Saved a raspberry version.' }),
    ]);
    const res = await runCompatChat({ cfg: cfg(f), system: 'SYS', turns: [{ role: 'user', content: 'raspberry please' }], tools, onText: () => {} });
    expect(entries).toHaveLength(1);
    expect(res).toEqual({ text: 'Saved a raspberry version.', truncated: false });
    const first = calls[0].body!;
    expect(calls[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(first.model).toBe('gemini-3.8-flash');
    expect(first.tool_choice).toBe('auto');
    expect((first.messages as { role: string }[])[0]).toEqual({ role: 'system', content: 'SYS' });
    const second = calls[1].body!.messages as Record<string, unknown>[];
    expect(second.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'tool']);
    // Gemini's thought signature travels back with the tool call
    expect(JSON.stringify(second[2])).toContain('thought_signature');
    expect(second[3].tool_call_id).toBe('c1');
    expect(JSON.parse(second[3].content as string).saved).toBe(true);
  });

  it('returns bad arguments to the model as an error instead of saving', async () => {
    const { tools, entries } = lib();
    const { f, calls } = fakeFetch([
      reply({ tool_calls: [{ id: 'c1', function: { name: 'create_recipe', arguments: '{"recipe": {"name": "X"' } }] }, 'tool_calls'),
      reply({ tool_calls: [{ id: 'c2', function: { name: 'create_recipe', arguments: '{"recipe": {"name": "X"}}' } }] }, 'tool_calls'),
      reply({ content: 'Sorry, fixed.' }),
    ]);
    await runCompatChat({ cfg: cfg(f), system: 's', turns: [{ role: 'user', content: 'x' }], tools, onText: () => {} });
    expect(entries).toHaveLength(0);
    const msgs = calls[2].body!.messages as Record<string, string>[];
    expect(msgs[3].content).toMatch(/^ERROR: .*INVALID_JSON/);
    expect(msgs[5].content).toMatch(/note is required/);
  });

  it('asks for JSON mode when the first request is rejected (model without tools)', async () => {
    const { f } = fakeFetch([{ status: 400, body: { error: { message: 'tools are not supported for this model' } } }]);
    await expect(runCompatChat({ cfg: cfg(f), system: 's', turns: [{ role: 'user', content: 'x' }], tools: lib().tools, onText: () => {} }))
      .rejects.toMatchObject({ code: 'no_tools' });
  });

  it('reads an error hidden in a 200 body (OpenRouter upstream failures)', async () => {
    const { f } = fakeFetch([reply({ content: 'hi' }), { body: { error: { code: 429, message: 'Provider saturated' } } }]);
    await runCompatChat({ cfg: cfg(f), system: 's', turns: [{ role: 'user', content: 'x' }], tools: [], onText: () => {} });
    await expect(runCompatChat({ cfg: cfg(f), system: 's', turns: [{ role: 'user', content: 'x' }], tools: [], onText: () => {} }))
      .rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('never runs a tool call cut off by the length limit', async () => {
    const { tools, entries } = lib();
    const { f } = fakeFetch([reply({ tool_calls: [{ id: 'c1', function: { name: 'create_recipe', arguments: '{"note":"n","recipe":{"name":"X"}}' } }] }, 'length')]);
    await expect(runCompatChat({ cfg: cfg(f), system: 's', turns: [{ role: 'user', content: 'x' }], tools, onText: () => {} })).rejects.toMatchObject({ code: 'truncated' });
    expect(entries).toHaveLength(0);
  });
});

describe('JSON mode for models without tools', () => {
  it('extracts JSON from fenced or chatty replies', () => {
    expect(extractJson('Sure!\n```json\n{"reply":"ok","action":"none"}\n```\nEnjoy')).toEqual({ reply: 'ok', action: 'none' });
    expect(extractJson('<think>{"no":1}</think>{"a":{"b":1}} trailing } brace')).toEqual({ a: { b: 1 } });
    expect(() => extractJson('no json here')).toThrow();
  });
  it('sends the JSON rules without tools and parses the action', async () => {
    const { f, calls } = fakeFetch([reply({ content: '{"reply":"Made it","action":"create","note":"n","changes":{"name":"Test","volume_l":10}}' })]);
    const act = await compatJson({ cfg: cfg(f), system: 'SYS', turns: [{ role: 'user', content: 'x' }] });
    expect(act).toMatchObject({ action: 'create', reply: 'Made it' });
    expect(calls[0].body!.tools).toBeUndefined();
    expect((calls[0].body!.messages as { content: string }[])[0].content).toContain('TOOLS ARE NOT AVAILABLE');
  });
});
