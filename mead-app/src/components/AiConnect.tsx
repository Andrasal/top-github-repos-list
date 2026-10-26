import { useEffect, useRef, useState } from 'react';
import { AiError, makeClient, MODEL, verifyKey } from '../lib/ai/anthropic';
import { clearAi, currentAi, maskKey, onAiChange, saveAi, type AiSettings } from '../lib/ai/settings';

const CONNECT_ERRORS: Record<string, string> = {
  bad_key: 'That key was rejected. Check it was copied in full (it starts with sk-ant-).',
  no_access: 'This key isn’t allowed to use Claude models. Check its workspace permissions in the Anthropic Console.',
  billing: 'Your Anthropic account needs credits or a payment method. Add them in the Console, then try again.',
  not_found: 'This key can’t use the model the assistant needs.',
  rate_limited: 'Anthropic is rate-limiting this key. Wait a minute and try again.',
  network: 'Couldn’t reach api.anthropic.com. Check your connection. (Inside a Claude artifact, direct API calls are blocked: use the hosted app.)',
  overloaded: 'Anthropic is busy right now. Try again in a minute.',
};

/** Live view of the saved key, shared by the chat and the header button. */
export function useAiSettings(): AiSettings | null {
  const [ai, setAi] = useState<AiSettings | null>(currentAi);
  useEffect(() => onAiChange(() => setAi(currentAi())), []);
  return ai;
}

export function AiConnect({ insideClaude, onDone }: { insideClaude: boolean; onDone?: () => void }) {
  const ai = useAiSettings();
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; detail: string } | null>(null);
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => () => ctl.current?.abort(), []);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    const k = key.trim();
    if (!k || busy) return;
    setBusy(true);
    setErr(null);
    ctl.current = new AbortController();
    try {
      const { model } = await verifyKey(makeClient(k), ctl.current.signal);
      saveAi({ provider: 'anthropic', apiKey: k, remember, verifiedAt: new Date().toISOString(), model });
      setKey('');
      onDone?.();
    } catch (e2) {
      const x = e2 as AiError;
      if (x.code !== 'cancelled') setErr({ text: CONNECT_ERRORS[x.code] ?? 'Couldn’t check that key.', detail: `${x.code}: ${x.message}` });
    } finally {
      setBusy(false);
      ctl.current = null;
    }
  }

  if (ai) {
    return (
      <div className="space-y-3 py-2 text-sm">
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
          <span className="text-2xl" aria-hidden>✅</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Connected to your Claude account</p>
            <p className="truncate text-xs text-stone-500">Key {maskKey(ai.apiKey)} · {ai.model} · {ai.remember ? 'remembered on this device' : 'until this tab closes'}</p>
          </div>
        </div>
        <p className="text-xs text-stone-500">Chats are billed by Anthropic to your API account. If Claude declines a request, Anthropic may answer it with another Claude model instead.</p>
        <div className="flex gap-2">
          {onDone && <button className="btn-primary" onClick={onDone}>Back to chat</button>}
          <button className="btn-ghost border border-stone-300 dark:border-stone-700" onClick={() => clearAi()}>Disconnect</button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-3 py-2 text-sm" onSubmit={connect}>
      <div className="text-center">
        <p className="text-3xl" aria-hidden>🔒</p>
        <p className="font-semibold">Connect your AI to unlock the assistant</p>
        <p className="mx-auto max-w-sm text-stone-500">
          {insideClaude
            ? 'You can also use your own Anthropic API key instead of the Claude account this page runs in.'
            : 'The recipe assistant runs on your own Claude API account. Everything else in Mead Lab works without it.'}
        </p>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-stone-600 dark:text-stone-300">
        <li>Sign in at <a className="underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a> and add credits (pay as you go).</li>
        <li>Create an API key and paste it here.</li>
      </ol>
      <p className="rounded-lg bg-stone-100 p-2 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">
        A Claude.ai Pro or Max plan can’t be linked to other apps. The assistant needs an API key, which is billed separately per use.
      </p>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">Anthropic API key</span>
        <input type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…"
          className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-stone-700 dark:bg-stone-900" />
      </label>
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-0.5" />
        <span>Remember on this device. Leave unticked on a shared computer.</span>
      </label>
      <p className="text-xs text-stone-500">Your key stays in this browser and is sent only to Anthropic. It checks access to {MODEL}.</p>
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200" role="alert">
          {err.text}
          <details className="mt-1 text-stone-500"><summary className="cursor-pointer">Details</summary><code className="break-all">{err.detail}</code></details>
        </div>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={!key.trim() || busy}>{busy ? 'Checking…' : 'Connect'}</button>
        {busy && <button type="button" className="btn-ghost" onClick={() => ctl.current?.abort()}>Cancel</button>}
        {onDone && !busy && <button type="button" className="btn-ghost" onClick={onDone}>Back</button>}
      </div>
    </form>
  );
}
