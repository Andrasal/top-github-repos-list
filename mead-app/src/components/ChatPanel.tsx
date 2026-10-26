import { useEffect, useRef, useState } from 'react';
import type { Recipe } from '../lib/recipe';
import type { LibraryEntry } from '../lib/library';
import { ChatEvent, instructions, makeTools } from '../lib/chat';
import type { UnitSystem } from '../lib/units';
import type { Library } from './useLibrary';

type SampleFn = ((input: unknown, opts?: Record<string, unknown>) => Promise<{ text: string; truncated: boolean }>) & {
  limits(): Promise<{ tools?: { maxCount: number } }>;
};
type SavedCard = { entryId: string; name: string; version: number; from: string | null; abv: number };
interface Msg { id: string; role: 'user' | 'assistant'; text: string; saved?: SavedCard[]; note?: string }

const STORE = 'mead-lab:chat:v1';
const loadMsgs = (): Msg[] => { try { return JSON.parse(localStorage.getItem(STORE) ?? '[]'); } catch { return []; } };
const saveMsgs = (m: Msg[]) => { try { localStorage.setItem(STORE, JSON.stringify(m.slice(-40))); } catch { /* ignore */ } };
const mid = () => Math.random().toString(36).slice(2, 10);

const ERRORS: Record<string, string> = {
  not_granted: 'Claude isn’t allowed for this page. You can allow it from the artifact’s permissions.',
  sampling_disabled: 'Claude isn’t available for this account.',
  rate_limited: 'Too many requests right now. Wait a moment, then try again.',
  session_expired: 'Your session expired. Sign in again to keep chatting.',
  refused: 'Claude declined that request. Try rephrasing it.',
  prompt_too_large: 'The conversation got too long. Clear the chat and try again.',
  empty_completion: 'No answer came back. Try asking more simply.',
};
const FATAL = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);

const SUGGESTIONS = [
  'Design a 5-gallon cherry-vanilla dessert mead around 13 %',
  'Make the recipe I have open drier and a bit more acidic',
  'Add a floral twist to this recipe with a flower or herb',
  'Turn this into a sparkling session hydromel',
];

export function ChatPanel({ lib, draft, baseId, units, onOpenEntry }: {
  lib: Library; draft: Recipe; baseId: string | null; units: UnitSystem; onOpenEntry: (e: LibraryEntry) => void;
}) {
  const [sample, setSample] = useState<SampleFn | null | undefined>(undefined);
  const [toolsOk, setToolsOk] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(loadMsgs);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [fatal, setFatal] = useState('');
  const ctl = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // Tools read the latest state at execution time
  const live = useRef({ lib, draft, baseId });
  live.current = { lib, draft, baseId };

  useEffect(() => {
    let alive = true;
    const rt = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
    if (!rt?.use) { setSample(null); return; }
    rt.use('sample').then(async (s) => {
      if (!alive) return;
      if (!s) { setSample(null); return; }
      const fn = s as SampleFn;
      const lim = await fn.limits().catch(() => null);
      if (!alive) return;
      setToolsOk(!!lim?.tools);
      setSample(() => fn);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => { saveMsgs(msgs); endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || !sample || busy) return;
    const userMsg: Msg = { id: mid(), role: 'user', text: q };
    const reply: Msg = { id: mid(), role: 'assistant', text: '', saved: [] };
    const history = [...msgs, userMsg];
    setMsgs([...history, reply]);
    setInput('');
    setBusy(true);
    setStatus('Thinking…');
    const controller = new AbortController();
    ctl.current = controller;

    const update = (p: Partial<Msg>) => setMsgs((m) => m.map((x) => (x.id === reply.id ? { ...x, ...p, saved: p.saved ?? x.saved } : x)));
    const saved: SavedCard[] = [];
    const tools = makeTools({
      entries: () => live.current.lib.entries,
      draft: () => ({ recipe: live.current.draft, baseId: live.current.baseId }),
      save: (e) => live.current.lib.save(e),
      emit: (e: ChatEvent) => {
        if (e.kind === 'status') setStatus(e.text);
        else {
          saved.push({ entryId: e.entry.id, name: e.entry.name, version: e.entry.version, from: e.parent ? `${e.parent.name} v${e.parent.version}` : null, abv: e.abv });
          update({ saved: [...saved] });
          setStatus(`Saved ${e.entry.name} v${e.entry.version}`);
        }
      },
    });
    const base = live.current.lib.entries.find((e) => e.id === live.current.baseId);
    const rules = instructions(live.current.draft, base ? `${base.name} v${base.version}` : null, units)
      + (toolsOk ? '' : '\n\nNOTE: recipe tools are unavailable in this view. Answer in text only and tell the user to copy the changes into the editor.');
    const turns = [
      { role: 'user', content: rules },
      ...history.filter((m) => m.text.trim()).slice(-12).map((m) => ({ role: m.role, content: m.text })),
    ];
    if (turns[turns.length - 1].role !== 'user') turns.push({ role: 'user', content: q });
    try {
      const res = await sample(turns, {
        signal: controller.signal,
        modelTier: 'default',
        ...(toolsOk ? { tools } : { cache: false }),
        onText: ({ text: t }: { text: string }) => { setStatus(''); update({ text: t }); },
      });
      update({ text: res.text, note: res.truncated ? 'Cut short. Ask for less at a time.' : undefined });
    } catch (e) {
      const err = e as { code?: string; text?: string };
      const code = err.code ?? 'upstream_error';
      if (FATAL.has(code)) setFatal(ERRORS[code] ?? 'Claude isn’t available in this view.');
      if (code === 'cancelled') update({ text: err.text ?? '', note: 'Stopped.' });
      else if (code === 'refused') update({ text: '', note: ERRORS.refused });
      else update({ text: err.text ?? '', note: ERRORS[code] ?? 'Something went wrong. Try again.' });
    } finally {
      setBusy(false);
      setStatus('');
      ctl.current = null;
    }
  }

  if (sample === undefined) return <p className="py-8 text-center text-sm text-stone-500">Connecting to Claude…</p>;
  if (sample === null || fatal) {
    return (
      <div className="space-y-2 py-6 text-center text-sm">
        <p className="text-3xl" aria-hidden>🤖</p>
        <p className="font-semibold">The recipe assistant runs inside Claude</p>
        <p className="mx-auto max-w-sm text-stone-500">{fatal || 'Open this app as a Claude artifact to chat. Everything else works here as normal.'}</p>
      </div>
    );
  }

  const entryById = (id: string) => lib.entries.find((e) => e.id === id);
  return (
    <div className="flex h-[70vh] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto pb-2" aria-live="polite">
        {msgs.length === 0 && (
          <div className="space-y-2 py-2 text-sm">
            <p className="text-stone-600 dark:text-stone-300">Ask for a new recipe or a change to one you have. Every change saves a <b>new version</b>; your originals are always kept.</p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => <button key={s} className="rounded-lg border border-stone-200 px-3 py-2 text-left hover:bg-honey-50 dark:border-stone-700 dark:hover:bg-honey-900/20" onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
            <div className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-honey-500 text-stone-950' : 'bg-stone-100 dark:bg-stone-800'}`}>
              {m.text && <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>}
              {!m.text && busy && m.id === msgs[msgs.length - 1]?.id && <div className="text-stone-500">{status || 'Thinking…'}</div>}
              {m.saved?.map((c) => {
                const e = entryById(c.entryId);
                return (
                  <div key={c.entryId} className="mt-2 flex items-center gap-2 rounded-xl border border-violet-200 bg-white p-2 dark:border-violet-900 dark:bg-stone-900">
                    <span className="text-lg" aria-hidden>📜</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.name} v{c.version}</span>
                      <span className="block text-xs text-stone-500">{c.from ? `copy of ${c.from}, original kept` : 'new recipe'} · {c.abv.toFixed(1)} %</span>
                    </span>
                    {e ? <button className="btn-primary px-2 py-1 text-xs" onClick={() => onOpenEntry(e)}>Open</button> : <span className="text-xs text-stone-400">deleted</span>}
                  </div>
                );
              })}
              {m.note && <div className="mt-1 text-xs text-stone-500">{m.note}</div>}
            </div>
          </div>
        ))}
        {busy && status && msgs[msgs.length - 1]?.text && <p className="text-xs text-stone-500">{status}</p>}
        <div ref={endRef} />
      </div>
      <form className="flex items-end gap-2 border-t border-stone-200 pt-2 dark:border-stone-800" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <label htmlFor="chat-input" className="sr-only">Message</label>
        <textarea id="chat-input" rows={2} value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. Make a 10 L blackberry mead, semi-sweet"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          className="min-w-0 flex-1 resize-none rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900" />
        {busy
          ? <button type="button" className="btn-ghost border border-stone-300 dark:border-stone-700" onClick={() => ctl.current?.abort()}>Stop</button>
          : <button type="submit" className="btn-primary" disabled={!input.trim()}>Send</button>}
      </form>
      <div className="flex justify-between pt-1 text-[11px] text-stone-500">
        <span>{toolsOk ? 'Uses your Claude usage. Replies with saves can take 30–90 s.' : 'Text answers only in this view.'}</span>
        {msgs.length > 0 && !busy && <button className="underline" onClick={() => setMsgs([])}>Clear chat</button>}
      </div>
    </div>
  );
}
