import { describe, expect, it, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import Ajv from 'ajv';
import { makeTools, type ChatTool } from '../chat';
import type { LibraryEntry } from '../library';
import { DEFAULT_RECIPE } from '../recipe';
import { AiError, MODEL, normaliseTurns, runChat, toAiError, verifyKey, visibleText, type Client } from '../ai/anthropic';
import { validate, type Schema } from '../ai/validate';

type Msg = Partial<Anthropic.Beta.BetaMessage> & { content: Anthropic.Beta.BetaContentBlock[] };
const text = (t: string) => ({ type: 'text', text: t, citations: null }) as Anthropic.Beta.BetaTextBlock;
const toolUse = (id: string, name: string, input: unknown) => ({ type: 'tool_use', id, name, input }) as Anthropic.Beta.BetaToolUseBlock;
const msg = (stop: string, content: Anthropic.Beta.BetaContentBlock[], iterations: unknown = null): Msg =>
  ({ stop_reason: stop as Anthropic.Beta.BetaMessage['stop_reason'], content, usage: { iterations } as Anthropic.Beta.BetaUsage });

/** Fake client: each stream() call takes the next scripted reply (a message or an error). */
function fakeClient(script: (Msg | Error)[], models = [MODEL]) {
  const calls: Anthropic.Beta.MessageCreateParams[] = [];
  const client = {
    models: { list: vi.fn(async () => ({ data: models.map((id) => ({ id })) })) },
    beta: {
      messages: {
        stream: vi.fn((params: Anthropic.Beta.MessageCreateParams) => {
          calls.push(structuredClone(params));
          const next = script.shift();
          const handlers: ((d: string) => void)[] = [];
          return {
            on(ev: string, fn: (d: string) => void) { if (ev === 'text') handlers.push(fn); return this; },
            async finalMessage() {
              if (!next) throw new Error('script exhausted');
              if (next instanceof Error) throw next;
              for (const b of next.content) if (b.type === 'text') handlers.forEach((h) => h(b.text));
              return next;
            },
          };
        }),
      },
    },
  };
  return { client: client as unknown as Client, calls };
}

function toolsWithLibrary() {
  const lib: LibraryEntry[] = [];
  const saved: LibraryEntry[] = [];
  const tools = makeTools({
    entries: () => lib,
    draft: () => ({ recipe: DEFAULT_RECIPE, baseId: null }),
    save: async (e) => { lib.push(e); saved.push(e); },
    emit: () => {},
  });
  return { tools, saved, lib };
}

const authErr = () => new Anthropic.AuthenticationError(401, { type: 'error' }, 'invalid x-api-key', new Headers());
const badReq = () => new Anthropic.BadRequestError(400, { type: 'error' }, 'Unexpected value for anthropic-beta', new Headers());

describe('validate (tool input check for eager input streaming)', () => {
  const ajv = new Ajv({ strict: false });
  const { tools } = toolsWithLibrary();
  const cases: [string, unknown][] = [
    ['create_recipe', { note: 'n', recipe: { name: 'X', volume_l: 20, honeys: [{ id: 'wildflower', kg: 6 }] } }],
    ['create_recipe', { note: 'n', recipe: { volume_l: 20 } }],
    ['create_recipe', { recipe: { name: 'X' } }],
    ['edit_recipe', { base_id: 'draft', note: 'n', changes: { fruits: [{ id: 'cherry', kg: '3' }] } }],
    ['edit_recipe', { base_id: 'draft', note: 'n', changes: { fruits: [{ id: 'cherry', kg: 3, stage: 'tertiary' }] } }],
    ['edit_recipe', { base_id: 'draft', note: 'n', changes: { additions: [{ id: 'malic', g: 4, stage: 'must' }] } }],
    ['get_recipe', {}],
    ['get_recipe', { id: 5 }],
    ['analyze_recipe', { changes: { honeys: 'lots' } }],
  ];
  it.each(cases)('%s agrees with Ajv on %j', (name, input) => {
    const schema = tools.find((t) => t.name === name)!.inputSchema!;
    expect(validate(input, schema as Schema).length === 0).toBe(ajv.validate(schema, input));
  });
});

describe('runChat (own-key Claude backend)', () => {
  it('sends the skill defaults and runs a create_recipe tool round', async () => {
    const { tools, saved } = toolsWithLibrary();
    const input = { note: 'A cherry mead', recipe: { name: 'Cherry test', volume_l: 19, honeys: [{ id: 'wildflower', kg: 5.5 }], fruits: [{ id: 'blackberry', kg: 3, stage: 'secondary' }] } };
    const { client, calls } = fakeClient([
      msg('tool_use', [text('Making it now.'), toolUse('t1', 'create_recipe', input)]),
      msg('end_turn', [text('Saved Cherry test v1.')]),
    ]);
    const seen: string[] = [];
    const res = await runChat({ client, system: 'SYS', turns: [{ role: 'user', content: 'cherry mead' }], tools, onText: (t) => seen.push(t) });
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('Cherry test');
    expect(res.text).toBe('Making it now.\n\nSaved Cherry test v1.');
    expect(res.truncated).toBe(false);
    const p = calls[0] as unknown as Record<string, unknown>;
    expect(p.model).toBe('claude-opus-5-5');
    expect(p.thinking).toEqual({ type: 'adaptive' });
    expect(p.output_config).toEqual({ effort: 'medium' });
    expect(p.fallbacks).toBe('default');
    expect(p.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(p.system).toBe('SYS');
    expect((p.tools as { eager_input_streaming: boolean }[]).every((t) => t.eager_input_streaming)).toBe(true);
    expect('tool_choice' in p).toBe(false);
    // Second call carries the assistant turn and ONE user message with the tool result
    const m2 = calls[1].messages;
    expect(m2.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    const results = m2[2].content as Anthropic.Beta.BetaToolResultBlockParam[];
    expect(results).toHaveLength(1);
    expect(results[0].tool_use_id).toBe('t1');
    expect(results[0].is_error).toBeUndefined();
    expect(JSON.parse(results[0].content as string).saved).toBe(true);
  });

  it('does not run a tool whose input fails the schema; returns INVALID_JSON instead', async () => {
    const { tools, saved } = toolsWithLibrary();
    const { client, calls } = fakeClient([
      msg('tool_use', [toolUse('t1', 'create_recipe', { recipe: { name: 'X' } })]), // note missing
      msg('end_turn', [text('Fixed.')]),
    ]);
    await runChat({ client, system: 's', turns: [{ role: 'user', content: 'x' }], tools, onText: () => {} });
    expect(saved).toHaveLength(0);
    const r = (calls[1].messages[2].content as Anthropic.Beta.BetaToolResultBlockParam[])[0];
    expect(r.is_error).toBe(true);
    expect(JSON.parse(r.content as string).INVALID_JSON).toContain('"name":"X"');
  });

  it('reports a tool exception as is_error and keeps going', async () => {
    const { tools } = toolsWithLibrary();
    const { client, calls } = fakeClient([
      msg('tool_use', [toolUse('t1', 'get_recipe', { id: 'nope' })]),
      msg('end_turn', [text('That id does not exist.')]),
    ]);
    await runChat({ client, system: 's', turns: [{ role: 'user', content: 'x' }], tools, onText: () => {} });
    const r = (calls[1].messages[2].content as Anthropic.Beta.BetaToolResultBlockParam[])[0];
    expect(r.is_error).toBe(true);
    expect(r.content).toMatch(/No saved recipe/);
  });

  it('never runs tools on a refusal or a max_tokens cut-off', async () => {
    for (const stop of ['refusal', 'max_tokens']) {
      const { tools, saved } = toolsWithLibrary();
      const { client } = fakeClient([msg(stop, [toolUse('t1', 'create_recipe', { note: 'n', recipe: { name: 'X' } })])]);
      const err = await runChat({ client, system: 's', turns: [{ role: 'user', content: 'x' }], tools, onText: () => {} }).catch((e) => e);
      expect(err).toBeInstanceOf(AiError);
      expect(err.code).toBe(stop === 'refusal' ? 'refused' : 'truncated');
      expect(saved).toHaveLength(0);
    }
  });

  it('returns a text answer cut at max_tokens as truncated', async () => {
    const { client } = fakeClient([msg('max_tokens', [text('Long answer…')])]);
    const res = await runChat({ client, system: 's', turns: [{ role: 'user', content: 'x' }], tools: [], onText: () => {} });
    expect(res).toMatchObject({ text: 'Long answer…', truncated: true });
  });

  it('retries once without the fallback beta when the account rejects it', async () => {
    const { client, calls } = fakeClient([badReq(), msg('end_turn', [text('Hi')])]);
    const res = await runChat({ client, system: 's', turns: [{ role: 'user', content: 'x' }], tools: [], onText: () => {} });
    expect(res.text).toBe('Hi');
    expect(res.usedFallbackBeta).toBe(false);
    expect((calls[1] as unknown as Record<string, unknown>).fallbacks).toBeUndefined();
  });

  it('surfaces API errors as typed codes and does not retry them', async () => {
    const { client, calls } = fakeClient([authErr()]);
    const err = await runChat({ client, system: 's', turns: [{ role: 'user', content: 'x' }], tools: [], onText: () => {}, fallbacks: false }).catch((e) => e);
    expect(err.code).toBe('bad_key');
    expect(calls).toHaveLength(1);
  });

  it('re-issues the turn when a tool input could not be parsed at all (capped)', async () => {
    const { client, calls } = fakeClient([new SyntaxError('Unexpected token'), msg('end_turn', [text('ok')])]);
    const res = await runChat({ client, system: 's', turns: [{ role: 'user', content: 'x' }], tools: [], onText: () => {} });
    expect(res.text).toBe('ok');
    expect(calls).toHaveLength(2);
    const { client: c2 } = fakeClient([new SyntaxError('a'), new SyntaxError('b'), new SyntaxError('c'), msg('end_turn', [])]);
    await expect(runChat({ client: c2, system: 's', turns: [{ role: 'user', content: 'x' }], tools: [], onText: () => {} })).rejects.toBeInstanceOf(AiError);
  });

  it('notes a server-side fallback and hides the declined partial text', async () => {
    const content = [text('partial from first model'), { type: 'fallback' } as unknown as Anthropic.Beta.BetaContentBlock, text('Answer from backup.')];
    expect(visibleText(content)).toBe('Answer from backup.');
    const { client } = fakeClient([msg('end_turn', content, [{ type: 'message' }, { type: 'fallback_message' }])]);
    const res = await runChat({ client, system: 's', turns: [{ role: 'user', content: 'x' }], tools: [], onText: () => {} });
    expect(res).toMatchObject({ text: 'Answer from backup.', fellBack: true });
  });

  it('stops tool execution when the user aborts', async () => {
    const ctl = new AbortController();
    const slow: ChatTool = { name: 'slow', description: 'd', execute: () => { ctl.abort(); throw new Error('aborted'); } };
    const { client } = fakeClient([msg('tool_use', [toolUse('t1', 'slow', {})])]);
    const err = await runChat({ client, system: 's', turns: [{ role: 'user', content: 'x' }], tools: [slow], onText: () => {}, signal: ctl.signal }).catch((e) => e);
    expect(err.code).toBe('cancelled');
  });
});

describe('verifyKey and errors', () => {
  it('accepts a key that can use the model', async () => {
    const { client } = fakeClient([]);
    await expect(verifyKey(client)).resolves.toEqual({ model: MODEL });
  });
  it('rejects a key without the model', async () => {
    const { client } = fakeClient([], ['claude-haiku-5-5']);
    await expect(verifyKey(client)).rejects.toMatchObject({ code: 'not_found' });
  });
  it('maps SDK error classes to codes', () => {
    expect(toAiError(authErr()).code).toBe('bad_key');
    expect(toAiError(new Anthropic.RateLimitError(429, {}, 'slow', new Headers())).code).toBe('rate_limited');
    expect(toAiError(new Anthropic.APIError(402, {}, 'pay', new Headers())).code).toBe('billing');
    expect(toAiError(new Anthropic.APIError(529, {}, 'busy', new Headers())).code).toBe('overloaded');
    expect(toAiError(new Anthropic.APIConnectionError({ message: 'offline' })).code).toBe('network');
    expect(toAiError(new Anthropic.APIUserAbortError()).code).toBe('cancelled');
  });
});

describe('normaliseTurns', () => {
  it('starts with the user, drops empties and merges same-role neighbours', () => {
    expect(normaliseTurns([
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'a' },
      { role: 'assistant', content: '' },
      { role: 'user', content: 'b' },
      { role: 'assistant', content: 'c' },
    ])).toEqual([{ role: 'user', content: 'a\n\nb' }, { role: 'assistant', content: 'c' }]);
  });
});

describe('AI settings storage', () => {
  it('remembers in localStorage only when asked, and clears both', async () => {
    const mk = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }; };
    const local = mk(); const session = mk();
    vi.stubGlobal('window', { localStorage: local, sessionStorage: session, dispatchEvent: () => true, addEventListener() {}, removeEventListener() {} });
    const s = await import('../ai/settings');
    s.saveAi({ provider: 'anthropic', apiKey: 'sk-ant-abcdefghijklmnop', remember: false, verifiedAt: 'x', model: MODEL });
    expect(local.m.size).toBe(0);
    expect(s.currentAi()?.apiKey).toBe('sk-ant-abcdefghijklmnop');
    s.saveAi({ provider: 'anthropic', apiKey: 'sk-ant-abcdefghijklmnop', remember: true, verifiedAt: 'x', model: MODEL });
    expect(session.m.size).toBe(0);
    expect(local.m.size).toBe(1);
    expect(s.maskKey('sk-ant-abcdefghijklmnop')).toBe('sk-ant-…mnop');
    s.clearAi();
    expect(s.currentAi()).toBeNull();
    vi.unstubAllGlobals();
  });
});
