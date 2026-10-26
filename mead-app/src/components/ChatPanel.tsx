import { useEffect, useRef, useState } from 'react';
import type { Recipe } from '../lib/recipe';
import type { LibraryEntry } from '../lib/library';
import { ChatEvent, instructions, JSON_MODE_RULES, makeTools, parseJsonAction } from '../lib/chat';
import type { UnitSystem } from '../lib/units';
import type { Library } from './useLibrary';

type SampleFn = ((input: unknown, opts?: Record<string, unknown>) => Promise<{ text: string; truncated: boolean }>) & {
  limits(): Promise<{ tools?: { maxCount: number } }>;
  json<T = unknown>(input: unknown, opts?: Record<string, unknown>): Promise<T>;
};
type SavedCard = { entryId: string; name: string; version: number; from: string | null; abv: number };
interface Msg { id: string; role: 'user' | 'assistant'; text: string; saved?: SavedCard[]; note?: string; failed?: { question: string; detail: string } }

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
/** Failures of the TOOLS call that a simpler JSON-mode call may avoid (SPEC §24.3). */
const FALLBACK = new Set(['invalid_request', 'transform_error', 'tools_unavailable', 'upstream_error', 'empty_completion', 'prompt_too_large']);

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
  const [jsonMode, setJsonMode] = useState(false);
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

  async function send(text: string, retry = false) {
    const q = text.trim();
    if (!q || !sample || busy) return;
    const userMsg: Msg = { id: mid(), role: 'user', text: q };
    const reply: Msg = { id: mid(), role: 'assistant', text: '', saved: [] };
    // A retry re-asks the same question without duplicating the user's bubble
    const base = retry ? msgs.filter((m) => !(m.role === 'assistant' && m.failed?.question === q)) : msgs;
    const history = retry && base[base.length - 1]?.text === q ? base : [...base, userMsg];
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
    let streamed = '';
    const fail = (code: string, message: string, keep = '') => {
      if (FATAL.has(code)) setFatal(ERRORS[code] ?? 'Claude isn’t available in this view.');
      if (code === 'cancelled') { update({ text: keep, note: 'Stopped.' }); return; }
      update({
        text: code === 'refused' ? '' : keep,
        note: ERRORS[code] ?? 'Claude couldn’t answer this time.',
        failed: { question: q, detail: `${code}${message ? `: ${message}` : ''}` },
      });
    };

    try {
      const baseEntry = live.current.lib.entries.find((e) => e.id === live.current.baseId);
      const rules = instructions(live.current.draft, baseEntry ? `${baseEntry.name} v${baseEntry.version}` : null, units);
      const convo = history.filter((m) => m.text.trim()).slice(-12).map((m) => ({ role: m.role, content: m.text }));
      if (convo[convo.length - 1]?.role !== 'user') convo.push({ role: 'user', content: q });

      // 1) Tools mode: Claude reads, checks and saves recipes through page functions
      if (toolsOk && !jsonMode) {
        try {
          const res = await sample([{ role: 'user', content: rules }, ...convo], {
            signal: controller.signal,
            modelTier: 'default',
            tools,
            onText: ({ text: t }: { text: string }) => { streamed = t; setStatus(''); update({ text: t }); },
          });
          update({ text: res.text, note: res.truncated ? 'Cut short. Ask for less at a time.' : undefined });
          return;
        } catch (e) {
          const err = e as { code?: string; message?: string; text?: string };
          const code = err.code ?? 'upstream_error';
          // Fall back only when nothing visible happened yet (no text, no saves) and the cause isn't the user's
          if (!FALLBACK.has(code) || streamed || saved.length) { fail(code, err.message ?? '', err.text ?? streamed); return; }
          if (code !== 'upstream_error') setJsonMode(true); // tools can't run in this view; stay in JSON mode
          setStatus('Retrying in simple mode…');
        }
      }

      // 2) JSON mode: Claude returns one action; the page validates and saves it (SPEC §24.3)
      const raw = await sample.json([{ role: 'user', content: rules + '\n' + JSON_MODE_RULES }, ...convo], {
        signal: controller.signal, modelTier: 'default', cache: false,
      });
      const act = parseJsonAction(raw);
      let summary = '';
      if (act.action !== 'none' && act.changes) {
        setStatus('Saving a new version…');
        try {
          const tool = tools.find((t) => t.name === (act.action === 'create' ? 'create_recipe' : 'edit_recipe'))!;
          const out = (await tool.execute(act.action === 'create'
            ? { note: act.note ?? 'Created by the assistant', recipe: act.changes }
            : { base_id: act.base_id ?? 'draft', note: act.note ?? 'Edited by the assistant', changes: act.changes }, { signal: controller.signal })) as
            { name: string; version: number; computed: { og: number; abv: number; fg: number; finished_ph: number; flags: string[] } };
          const c = out.computed;
          summary = `\n\nSaved ${out.name} v${out.version}: OG ${c.og.toFixed(3)} · FG ${c.fg.toFixed(3)} · ${c.abv.toFixed(1)} % ABV · pH ≈ ${c.finished_ph.toFixed(2)}${c.flags.length ? `\nCheck recipe: ${c.flags.join('; ')}` : ''}`;
        } catch (e) {
          summary = `\n\n(I couldn’t save that change: ${(e as Error).message})`;
        }
      }
      update({ text: (act.reply || 'Done.') + summary, note: jsonMode || !toolsOk ? undefined : 'Answered in simple mode.' });
    } catch (e) {
      const err = e as { code?: string; message?: string; text?: string };
      fail(err.code ?? 'upstream_error', err.message ?? String(e), streamed);
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
              {m.failed && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  {!busy && <button className="btn-ghost border border-stone-300 px-2 py-0.5 text-xs dark:border-stone-700" onClick={() => send(m.failed!.question, true)}>Try again</button>}
                  <details className="text-stone-500"><summary className="cursor-pointer">Details</summary><code className="break-all">{m.failed.detail}</code></details>
                </div>
              )}
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
        <span>{toolsOk && !jsonMode ? 'Uses your Claude usage. Replies with saves can take 30–90 s.' : 'Simple mode: Claude proposes a change and the app saves it.'}</span>
        {msgs.length > 0 && !busy && <button className="underline" onClick={() => setMsgs([])}>Clear chat</button>}
      </div>
    </div>
  );
}
