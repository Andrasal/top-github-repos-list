import { useState } from 'react';
import { analyzeRecipe, Recipe } from '../lib/recipe';
import { lineages, LibraryEntry } from '../lib/library';
import type { Library } from './useLibrary';
import { PresetPicker } from './PresetPicker';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function AuthorBadge({ author }: { author: LibraryEntry['author'] }) {
  return author === 'ai'
    ? <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-900 dark:bg-violet-900/50 dark:text-violet-100">AI</span>
    : <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-semibold text-stone-700 dark:bg-stone-700 dark:text-stone-100">You</span>;
}

export function LibraryPanel({ lib, current, currentBaseId, onOpen, onNew }: {
  lib: Library; current: Recipe; currentBaseId: string | null;
  onOpen: (e: LibraryEntry) => void; onNew: (r: Recipe) => void;
}) {
  const [tab, setTab] = useState<'saved' | 'new'>(lib.entries.length ? 'saved' : 'new');
  const [open, setOpen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const groups = lineages(lib.entries);
  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-1 rounded-lg bg-stone-100 p-1 dark:bg-stone-800" role="tablist">
        {(['saved', 'new'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex-1 rounded-md py-1.5 font-medium ${tab === t ? 'bg-white shadow dark:bg-stone-600' : 'text-stone-500'}`}>
            {t === 'saved' ? `Saved (${groups.length})` : 'Start new'}
          </button>
        ))}
      </div>
      <p className="text-xs text-stone-500">
        {lib.kind === 'cloud' ? '☁️ Saved privately to your Claude account, so it syncs across your devices.' : '💾 Saved in this browser only.'} Saved versions are never overwritten:
        opening one gives you a copy, and saving creates the next version.
      </p>
      {lib.error && <p role="alert" className="rounded bg-orange-100 p-2 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100">{lib.error}</p>}

      {tab === 'new' ? (
        <div className="space-y-3">
          <button className="btn-ghost w-full justify-center border border-dashed border-stone-300 py-2 dark:border-stone-700"
            onClick={() => onNew({ ...current, name: 'New mead', honeys: [{ uid: 'h1', honeyId: 'wildflower', massKg: 0.3 * current.targetVolumeL }], fruits: [], spices: [], sugars: [], adjustments: [], targetFg: null, log: { pitchedAt: null, readings: [], dosesDone: [false, false, false, false] } })}>
            Blank traditional mead
          </button>
          <PresetPicker current={current} onPick={onNew} />
        </div>
      ) : groups.length === 0 ? (
        <p className="py-6 text-center text-stone-500">No saved recipes yet. Use "Save" in the bar under the header, or ask the AI assistant to design one.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((g) => {
            const a = analyzeRecipe(g.latest.recipe);
            const expanded = open === g.lineageId;
            return (
              <li key={g.lineageId} className="rounded-xl border border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-3 p-3">
                  <span className="h-8 w-8 shrink-0 rounded-full border border-stone-300 dark:border-stone-600" style={{ background: a.color.hex }} aria-hidden />
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(expanded ? null : g.lineageId)} aria-expanded={expanded}>
                    <span className="block truncate font-semibold">{g.name}</span>
                    <span className="tabular block text-xs text-stone-500">v{g.latest.version} · {a.abv.toFixed(1)} % · {a.sweetness} · {g.versions.length} version{g.versions.length > 1 ? 's' : ''} {expanded ? '▲' : '▼'}</span>
                  </button>
                  <button className="btn-primary shrink-0" onClick={() => onOpen(g.latest)}>Open</button>
                </div>
                {expanded && (
                  <ol className="border-t border-stone-200 dark:border-stone-800">
                    {g.versions.map((v) => {
                      const va = analyzeRecipe(v.recipe);
                      return (
                        <li key={v.id} className={`flex flex-wrap items-center gap-2 px-3 py-2 ${v.id === currentBaseId ? 'bg-honey-50 dark:bg-honey-900/20' : ''}`}>
                          <span className="tabular w-8 font-semibold">v{v.version}</span>
                          <AuthorBadge author={v.author} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{v.note}</span>
                            <span className="tabular block text-xs text-stone-500">{fmtDate(v.createdAt)} · OG {va.og.toFixed(3)} · {va.abv.toFixed(1)} %{v.id === currentBaseId ? ' · open now' : ''}</span>
                          </span>
                          {confirmDelete === v.id ? (
                            <span className="flex gap-1">
                              <button className="btn-primary text-xs" onClick={() => { lib.remove(v.id); setConfirmDelete(null); }}>Delete v{v.version}</button>
                              <button className="btn-ghost text-xs" onClick={() => setConfirmDelete(null)}>Keep</button>
                            </span>
                          ) : (
                            <>
                              <button className="btn-ghost text-xs" onClick={() => onOpen(v)}>Open copy</button>
                              <button className="btn-ghost text-xs text-stone-400" aria-label={`Delete version ${v.version}`} onClick={() => setConfirmDelete(v.id)}>✕</button>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
