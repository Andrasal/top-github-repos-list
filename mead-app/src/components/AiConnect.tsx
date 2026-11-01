import { useEffect, useRef, useState } from 'react';
import { makeClient, MODEL, verifyKey } from '../lib/ai/anthropic';
import { AiError } from '../lib/ai/errors';
import { listCompatModels } from '../lib/ai/openai-compat';
import { chatModels, pickModel, preset, PROVIDERS, type ProviderId } from '../lib/ai/providers';
import { clearAi, currentAi, maskKey, onAiChange, saveAi, type AiSettings } from '../lib/ai/settings';

const connectError = (code: string, name: string): string => ({
  bad_key: `${name} rejected that key. Check it was copied in full.`,
  no_access: `This key isn’t allowed to use ${name}’s models. Check its permissions.`,
  billing: `Your ${name} account needs credits or a payment method.`,
  not_found: name === 'Claude (Anthropic)' ? 'This key can’t use the model the assistant needs.' : 'No models found at that address. Check the API address.',
  rate_limited: `${name} is rate-limiting this key. Wait a minute and try again.`,
  network: `Couldn’t reach ${name}. Check your connection and the API address. (Inside a Claude artifact, outside AI services are blocked: use the hosted app.)`,
  overloaded: `${name} is busy right now. Try again in a minute.`,
}[code] ?? `Couldn’t connect to ${name}.`);

/** Live view of the saved AI connection, shared by the chat and the header button. */
export function useAiSettings(): AiSettings | null {
  const [ai, setAi] = useState<AiSettings | null>(currentAi);
  useEffect(() => onAiChange(() => setAi(currentAi())), []);
  return ai;
}

export const providerName = (ai: AiSettings) => preset(ai.provider).name;

export function AiConnect({ insideClaude, onDone }: { insideClaude: boolean; onDone?: () => void }) {
  const ai = useAiSettings();
  const [pick, setPick] = useState<ProviderId | null>(null);
  const [key, setKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; detail: string } | null>(null);
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => () => ctl.current?.abort(), []);

  const choose = (id: ProviderId) => { setPick(id); setBaseUrl(preset(id).baseUrl); setErr(null); };

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    if (!pick || busy) return;
    const p = preset(pick);
    const k = key.trim();
    const base = baseUrl.trim();
    if ((p.needsKey && !k) || (pick !== 'anthropic' && !base)) return;
    setBusy(true);
    setErr(null);
    ctl.current = new AbortController();
    try {
      let model = MODEL;
      let models: string[] | undefined;
      if (pick === 'anthropic') ({ model } = await verifyKey(makeClient(k), ctl.current.signal));
      else {
        const ids = await listCompatModels({ baseUrl: base, apiKey: k }, ctl.current.signal);
        models = chatModels(ids);
        model = pickModel(ids, p);
      }
      saveAi({ provider: pick, apiKey: k, baseUrl: pick === 'anthropic' ? undefined : base, remember, verifiedAt: new Date().toISOString(), model, models });
      setKey('');
      setPick(null);
      onDone?.();
    } catch (e2) {
      const x = e2 instanceof AiError ? e2 : new AiError('upstream_error', String(e2));
      if (x.code !== 'cancelled') setErr({ text: connectError(x.code, p.name), detail: `${x.code}: ${x.message}` });
    } finally {
      setBusy(false);
      ctl.current = null;
    }
  }

  // Connected: show what is in use, let the user switch model or disconnect
  if (ai) {
    const p = preset(ai.provider);
    return (
      <div className="space-y-3 py-2 text-sm">
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
          <span className="text-2xl" aria-hidden>✅</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Connected to {p.name}</p>
            <p className="truncate text-xs text-stone-500">Key {maskKey(ai.apiKey)} · {ai.remember ? 'remembered on this device' : 'until this tab closes'}</p>
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">Model</span>
          {ai.models && ai.models.length > 1 ? (
            <select value={ai.model} onChange={(e) => saveAi({ ...ai, model: e.target.value })}
              className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900">
              {ai.models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : <span className="block font-mono text-xs">{ai.model}</span>}
        </label>
        {p.note && <p className="text-xs text-stone-500">{p.note}</p>}
        <p className="text-xs text-stone-500">
          {ai.provider === 'anthropic'
            ? 'If Claude declines a request, Anthropic may answer it with another Claude model instead.'
            : 'Bigger models make better recipes. If replies are poor or saving fails, try a larger model.'}
        </p>
        <div className="flex gap-2">
          {onDone && <button className="btn-primary" onClick={onDone}>Back to chat</button>}
          <button className="btn-ghost border border-stone-300 dark:border-stone-700" onClick={() => clearAi()}>Disconnect</button>
        </div>
      </div>
    );
  }

  // Step 1: pick a provider
  if (!pick) {
    return (
      <div className="space-y-3 py-2 text-sm">
        <div className="text-center">
          <p className="text-3xl" aria-hidden>🔒</p>
          <p className="font-semibold">Connect your AI to unlock the assistant</p>
          <p className="mx-auto max-w-sm text-stone-500">
            {insideClaude
              ? 'You can also use your own AI account instead of the Claude account this page runs in.'
              : 'Use an AI account you already have, or a free one. Everything else in Mead Lab works without it.'}
          </p>
        </div>
        <div className="grid gap-1.5">
          {PROVIDERS.map((p) => (
            <button key={p.id} onClick={() => choose(p.id)}
              className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 px-3 py-2 text-left hover:bg-honey-50 dark:border-stone-700 dark:hover:bg-honey-900/20">
              <span className="font-medium">{p.name}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${p.free ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'}`}>{p.price}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-stone-500">Chat-app plans (Claude.ai, ChatGPT, Gemini app) can’t be linked to other apps. Each option above uses an API key from that company, and several are free.</p>
      </div>
    );
  }

  // Step 2: key (and address) for the chosen provider
  const p = preset(pick);
  const editableUrl = pick === 'custom' || pick === 'ollama';
  return (
    <form className="space-y-3 py-2 text-sm" onSubmit={connect}>
      <div className="flex items-center justify-between">
        <p className="font-semibold">{p.name}</p>
        <span className="text-xs text-stone-500">{p.price}</span>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-stone-600 dark:text-stone-300">
        {p.steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
      {p.keyUrl && <a className="inline-block text-xs underline" href={p.keyUrl} target="_blank" rel="noreferrer">Open {new URL(p.keyUrl).hostname} ↗</a>}
      {p.note && <p className="rounded-lg bg-stone-100 p-2 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">{p.note}</p>}
      {editableUrl && (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">API address</span>
          <input type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" spellCheck={false}
            className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-stone-700 dark:bg-stone-900" />
        </label>
      )}
      {pick !== 'ollama' && (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">API key{p.needsKey ? '' : ' (if the service needs one)'}</span>
          <input type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} placeholder={p.keyHint ?? 'Paste your key'}
            className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-stone-700 dark:bg-stone-900" />
        </label>
      )}
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-0.5" />
        <span>Remember on this device. Leave unticked on a shared computer.</span>
      </label>
      <p className="text-xs text-stone-500">Your key stays in this browser and is sent only to {p.name}.</p>
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200" role="alert">
          {err.text}
          <details className="mt-1 text-stone-500"><summary className="cursor-pointer">Details</summary><code className="break-all">{err.detail}</code></details>
        </div>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy || (p.needsKey && !key.trim()) || (editableUrl && !baseUrl.trim())}>{busy ? 'Checking…' : 'Connect'}</button>
        {busy
          ? <button type="button" className="btn-ghost" onClick={() => ctl.current?.abort()}>Cancel</button>
          : <button type="button" className="btn-ghost" onClick={() => { setPick(null); setErr(null); }}>Back</button>}
      </div>
    </form>
  );
}
