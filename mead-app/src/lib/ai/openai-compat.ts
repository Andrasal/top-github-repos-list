/**
 * Any AI with an OpenAI-style Chat Completions API: Gemini, OpenRouter, OpenAI, Groq,
 * Mistral, Ollama… (SPEC §25.5). Plain fetch from the browser with the subscriber's key.
 */
import type { ChatTool } from '../chat';
import { JSON_MODE_RULES, parseJsonAction, type JsonAction } from '../chat';
import { AiError } from './errors';
import { execToolCall } from './toolexec';

const MAX_ROUNDS = 10;

export interface CompatConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  fetch?: typeof fetch;
}
type Json = Record<string, unknown>;
interface ToolCall { id?: string; type?: string; function?: { name?: string; arguments?: string } }
interface ApiMessage { role: string; content?: unknown; tool_calls?: ToolCall[]; [k: string]: unknown }

const url = (base: string, path: string) => base.trim().replace(/\/+$/, '') + path;

function errorText(body: unknown): string {
  const b = (Array.isArray(body) ? body[0] : body) as Json | null;
  const e = b?.error as Json | string | undefined;
  return (typeof e === 'string' ? e : (e?.message as string)) ?? (b?.message as string) ?? (b?.raw as string) ?? '';
}

/** HTTP status → app error code. */
export function httpError(status: number, body: unknown): AiError {
  const m = errorText(body) || `HTTP ${status}`;
  const code =
    status === 401 ? 'bad_key' : status === 403 ? 'no_access' : status === 402 ? 'billing' : status === 404 ? 'not_found'
    : status === 413 ? 'too_large' : status === 429 ? 'rate_limited' : status === 400 || status === 422 ? 'invalid_request'
    : status === 503 || status === 529 ? 'overloaded' : 'upstream_error';
  return new AiError(code, m);
}

async function call(cfg: CompatConfig, path: string, body: Json | null, signal?: AbortSignal): Promise<Json> {
  const headers: Record<string, string> = {};
  if (body) headers['content-type'] = 'application/json';
  if (cfg.apiKey) headers.authorization = `Bearer ${cfg.apiKey}`;
  let res: Response;
  try {
    res = await (cfg.fetch ?? fetch)(url(cfg.baseUrl, path), { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, signal });
  } catch (e) {
    if (signal?.aborted) throw new AiError('cancelled', 'Stopped by the user');
    throw new AiError('network', (e as Error).message || 'Network error');
  }
  const raw = await res.text().catch(() => '');
  let parsed: unknown = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = { raw: raw.slice(0, 300) }; }
  if (!res.ok) throw httpError(res.status, parsed);
  // Some gateways (OpenRouter) report upstream failures inside a 200 body
  const inner = (parsed as Json | null)?.error as Json | undefined;
  if (inner) throw httpError(Number(inner.code) || 502, parsed);
  return (parsed ?? {}) as Json;
}

/** List the models a key can use. A rejected key on this plain GET means the key is wrong. */
export async function listCompatModels(cfg: Omit<CompatConfig, 'model'>, signal?: AbortSignal): Promise<string[]> {
  try {
    const body = await call({ ...cfg, model: '' }, '/models', null, signal);
    const rows = (body.data ?? body.models ?? []) as { id?: string; name?: string }[];
    const ids = rows.map((r) => (r.id ?? r.name ?? '').replace(/^models\//, '')).filter(Boolean);
    if (!ids.length) throw new AiError('not_found', 'This key has no models available.');
    return ids;
  } catch (e) {
    if (e instanceof AiError && e.code === 'invalid_request') throw new AiError('bad_key', e.message);
    throw e;
  }
}

const textOf = (content: unknown): string =>
  typeof content === 'string' ? content
    : Array.isArray(content) ? content.map((p) => (typeof p === 'string' ? p : (p as Json)?.text ?? '')).join('') : '';
/** Reasoning models sometimes put their thinking in <think> tags; the user only sees the answer. */
export const cleanText = (s: string) => s.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

export interface CompatArgs {
  cfg: CompatConfig;
  system: string;
  turns: { role: 'user' | 'assistant'; content: string }[];
  tools: ChatTool[];
  onText(fullText: string): void;
  onStatus?(s: string): void;
  signal?: AbortSignal;
}

/**
 * Tool loop. Throws AiError('no_tools') when the very first request is rejected, so the
 * caller can switch to JSON mode (models or gateways without function calling).
 */
export async function runCompatChat(a: CompatArgs): Promise<{ text: string; truncated: boolean }> {
  const messages: ApiMessage[] = [{ role: 'system', content: a.system }, ...a.turns];
  const tools = a.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema ?? { type: 'object', properties: {} } } }));
  let shown = '';
  for (let round = 0; round < MAX_ROUNDS; round++) {
    let body: Json;
    try {
      body = await call(a.cfg, '/chat/completions', { model: a.cfg.model, messages, tools, tool_choice: 'auto' }, a.signal);
    } catch (e) {
      const x = e as AiError;
      if (round === 0 && (x.code === 'invalid_request' || x.code === 'not_found')) throw new AiError('no_tools', x.message);
      x.text = shown;
      throw x;
    }
    const choice = (body.choices as Json[] | undefined)?.[0];
    if (!choice) throw new AiError('upstream_error', 'The AI sent an empty reply.', shown);
    const m = (choice.message ?? {}) as ApiMessage;
    const said = cleanText(textOf(m.content));
    if (said) { shown = shown ? `${shown}\n\n${said}` : said; a.onText(shown); }
    const calls = m.tool_calls ?? [];
    if (choice.finish_reason === 'content_filter') throw new AiError('refused', 'The AI declined this request.', shown);
    if (choice.finish_reason === 'length') {
      if (calls.length) throw new AiError('truncated', 'A tool call was cut off by the length limit.', shown);
      return { text: shown, truncated: true };
    }
    if (!calls.length) return { text: shown, truncated: false };

    // Echo the assistant turn back unchanged (keeps provider extras such as Gemini's thought signatures)
    messages.push({ ...m, role: 'assistant', content: textOf(m.content) || '', tool_calls: calls });
    for (const [i, c] of calls.entries()) {
      const name = c.function?.name ?? '';
      let input: unknown;
      let r: { content: string; isError: boolean };
      try { input = JSON.parse(c.function?.arguments || '{}'); } catch { input = undefined; }
      if (input === undefined) r = { content: JSON.stringify({ INVALID_JSON: c.function?.arguments ?? '' }), isError: true };
      else {
        a.onStatus?.('Working…');
        r = await execToolCall(a.tools.find((t) => t.name === name), name, input, a.signal);
      }
      messages.push({ role: 'tool', tool_call_id: c.id ?? `call_${round}_${i}`, content: r.isError ? `ERROR: ${r.content}` : r.content });
    }
  }
  return { text: shown ? `${shown}\n\n(Stopped after ${MAX_ROUNDS} steps. Ask me to continue.)` : '', truncated: true };
}

/** Pull the first JSON object out of a reply (tolerates code fences and chatter around it). */
export function extractJson(text: string): unknown {
  const s = cleanText(text).replace(/```(?:json)?/gi, '');
  const start = s.indexOf('{');
  for (let end = s.lastIndexOf('}'); start >= 0 && end > start; end = s.lastIndexOf('}', end - 1)) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch { /* try a shorter span */ }
  }
  throw new AiError('upstream_error', 'The AI didn’t answer in the expected format. Try again.');
}

/** JSON mode (SPEC §24.3) for models without function calling: one action the page applies itself. */
export async function compatJson(a: Omit<CompatArgs, 'tools' | 'onText'>): Promise<JsonAction> {
  const body = await call(a.cfg, '/chat/completions', {
    model: a.cfg.model,
    messages: [{ role: 'system', content: a.system + '\n' + JSON_MODE_RULES }, ...a.turns],
  }, a.signal);
  const choice = (body.choices as Json[] | undefined)?.[0];
  const text = textOf((choice?.message as ApiMessage | undefined)?.content);
  if (!text) throw new AiError('upstream_error', 'The AI sent an empty reply.');
  return parseJsonAction(extractJson(text));
}
