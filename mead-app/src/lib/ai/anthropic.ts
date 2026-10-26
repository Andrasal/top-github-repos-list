/**
 * Claude via the subscriber's own Anthropic API key (SPEC §25). Runs in the browser with
 * the official SDK: a streaming manual tool loop over the app's ChatTools.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { ChatTool } from '../chat';
import { validate, type Schema } from './validate';

export const MODEL = 'claude-opus-5-5';
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const MAX_ROUNDS = 10;

export type AiErrorCode =
  | 'bad_key' | 'no_access' | 'billing' | 'rate_limited' | 'overloaded' | 'network'
  | 'cancelled' | 'refused' | 'truncated' | 'invalid_request' | 'not_found' | 'too_large' | 'upstream_error';

export class AiError extends Error {
  constructor(public code: AiErrorCode, message: string, public text = '') { super(message); }
}

export type Client = Pick<Anthropic, 'models'> & { beta: { messages: Pick<Anthropic['beta']['messages'], 'stream'> } };

export function makeClient(apiKey: string): Anthropic {
  // The key belongs to the person using the page and goes only to api.anthropic.com.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

/** Map SDK errors to app codes (typed classes, never message matching). */
export function toAiError(err: unknown, text = ''): AiError {
  if (err instanceof AiError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  if (err instanceof Anthropic.APIUserAbortError) return new AiError('cancelled', msg, text);
  if (err instanceof Anthropic.APIConnectionError) return new AiError('network', msg, text);
  if (err instanceof Anthropic.AuthenticationError) return new AiError('bad_key', msg, text);
  if (err instanceof Anthropic.PermissionDeniedError) return new AiError('no_access', msg, text);
  if (err instanceof Anthropic.NotFoundError) return new AiError('not_found', msg, text);
  if (err instanceof Anthropic.RateLimitError) return new AiError('rate_limited', msg, text);
  if (err instanceof Anthropic.BadRequestError) return new AiError('invalid_request', msg, text);
  if (err instanceof Anthropic.APIError) {
    if (err.status === 402) return new AiError('billing', msg, text);
    if (err.status === 413) return new AiError('too_large', msg, text);
    if (err.status === 529) return new AiError('overloaded', msg, text);
    return new AiError('upstream_error', msg, text);
  }
  if (err instanceof DOMException && err.name === 'AbortError') return new AiError('cancelled', msg, text);
  return new AiError('upstream_error', msg, text);
}

/** Check a key by listing models; also confirms the app's model is available to it. */
export async function verifyKey(client: Client, signal?: AbortSignal): Promise<{ model: string }> {
  try {
    const page = await client.models.list({ limit: 100 }, { signal });
    const ids = page.data.map((m) => m.id);
    if (!ids.includes(MODEL)) throw new AiError('not_found', `This key can't use ${MODEL}. Available: ${ids.slice(0, 6).join(', ') || 'none'}`);
    return { model: MODEL };
  } catch (e) { throw toAiError(e); }
}

export function toApiTools(tools: ChatTool[]): Anthropic.Beta.BetaTool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: (t.inputSchema ?? { type: 'object', properties: {} }) as Anthropic.Beta.BetaTool.InputSchema,
    eager_input_streaming: true,
  }));
}

export interface RunArgs {
  client: Client;
  system: string;
  turns: { role: 'user' | 'assistant'; content: string }[];
  tools: ChatTool[];
  onText(fullText: string): void;
  onStatus?(s: string): void;
  signal?: AbortSignal;
  /** Set false when the account rejects the server-side fallback beta. */
  fallbacks?: boolean;
}
export interface RunResult { text: string; truncated: boolean; fellBack: boolean; usedFallbackBeta: boolean }

/** Text the user should see from one turn: after a fallback switch, the declined model's partial is dropped. */
export function visibleText(content: Anthropic.Beta.BetaContentBlock[]): string {
  let start = 0;
  content.forEach((b, i) => { if (b.type === 'fallback') start = i + 1; });
  return content.slice(start).filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('');
}

async function runTool(tool: ChatTool | undefined, block: Anthropic.Beta.BetaToolUseBlock, signal?: AbortSignal): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
  const base = { type: 'tool_result' as const, tool_use_id: block.id };
  if (!tool) return { ...base, is_error: true, content: `Unknown tool "${block.name}".` };
  // Eager input streaming: the server does not validate inputs, so check them here (SPEC §25.3)
  const problems = validate(block.input, tool.inputSchema as Schema | undefined);
  if (problems.length) return { ...base, is_error: true, content: JSON.stringify({ INVALID_JSON: JSON.stringify(block.input), problems }) };
  try {
    const out = await tool.execute(block.input as Record<string, unknown>, { signal });
    return { ...base, content: JSON.stringify(out ?? null) };
  } catch (e) {
    if (signal?.aborted) throw new AiError('cancelled', 'Stopped by the user');
    return { ...base, is_error: true, content: (e as Error).message || 'Tool failed' };
  }
}

export async function runChat(a: RunArgs): Promise<RunResult> {
  const tools = toApiTools(a.tools);
  const messages: Anthropic.Beta.BetaMessageParam[] = a.turns.map((t) => ({ role: t.role, content: t.content }));
  let useFallbacks = a.fallbacks !== false;
  let shown = '';
  let fellBack = false;
  let jsonRetries = 0;

  for (let round = 0; round < MAX_ROUNDS; ) {
    const prefix = shown ? `${shown}\n\n` : '';
    let live = '';
    let message: Anthropic.Beta.BetaMessage;
    try {
      const stream = a.client.beta.messages.stream({
        model: MODEL,
        max_tokens: 32000,
        system: a.system,
        messages,
        tools,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        ...(useFallbacks ? { betas: [FALLBACK_BETA], fallbacks: 'default' as const } : {}),
      }, { signal: a.signal });
      stream.on('text', (d) => { live += d; a.onText(prefix + live); });
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // An account without the fallback beta gets a 400 on the first call: retry once without it
      if (useFallbacks && round === 0 && !live && err instanceof Anthropic.BadRequestError) { useFallbacks = false; continue; }
      // Only a tool input the SDK could not parse at all is retried; API errors are reported
      if (err instanceof Anthropic.APIError || a.signal?.aborted || jsonRetries++ >= 2) throw toAiError(err, prefix + live);
      a.onStatus?.('Retrying…');
      a.onText(shown);
      continue;
    }
    round++;
    if (message.usage.iterations?.some((it) => it.type === 'fallback_message')) fellBack = true;
    const said = visibleText(message.content);
    shown = said ? prefix + said : shown;
    a.onText(shown);

    // A refusal can cut a tool call off mid-input: never run that turn's tools
    if (message.stop_reason === 'refusal') throw new AiError('refused', 'Claude declined this request.', shown);
    const calls = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (message.stop_reason === 'max_tokens') {
      if (calls.length) throw new AiError('truncated', 'A tool call was cut off by the length limit.', shown);
      return { text: shown, truncated: true, fellBack, usedFallbackBeta: useFallbacks };
    }
    if (message.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: message.content }); continue; }
    if (!calls.length) return { text: shown, truncated: false, fellBack, usedFallbackBeta: useFallbacks };

    messages.push({ role: 'assistant', content: message.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const c of calls) results.push(await runTool(a.tools.find((t) => t.name === c.name), c, a.signal));
    messages.push({ role: 'user', content: results });
  }
  return { text: shown ? `${shown}\n\n(Stopped after ${MAX_ROUNDS} steps. Ask me to continue.)` : '', truncated: true, fellBack, usedFallbackBeta: useFallbacks };
}

/** Chat history as valid API turns: starts with the user and alternates (same-role neighbours are merged). */
export function normaliseTurns(turns: { role: 'user' | 'assistant'; content: string }[]): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const t of turns) {
    if (!t.content.trim()) continue;
    if (!out.length && t.role !== 'user') continue;
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.content += `\n\n${t.content}`;
    else out.push({ ...t });
  }
  return out;
}
