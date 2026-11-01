import { useMemo, useState } from 'react';
import type { Analysis, Recipe } from '../lib/recipe';
import { SPICES, spiceById, type BotanicalGroup, type Spice } from '../lib/db';
import { L_PER_GAL } from '../lib/units';
import { DoseMeter } from './DoseMeter';
import { Card, NumberField, RemoveButton } from './ui';
import { uid, type UnitHelpers } from './units';

type Cat = 'all' | 'flowers' | 'spices' | 'wood' | 'tannin' | 'other' | 'aid';
const CATS: { id: Cat; label: string; groups: BotanicalGroup[] }[] = [
  { id: 'all', label: 'All', groups: [] },
  { id: 'flowers', label: '🌸 Flowers & herbs', groups: ['floral', 'herb'] },
  { id: 'spices', label: '🫙 Spices', groups: ['spice'] },
  { id: 'wood', label: '🪵 Wood & oak', groups: ['wood'] },
  { id: 'tannin', label: '🍂 Tannins', groups: ['tannin'] },
  { id: 'other', label: '✨ Other', groups: ['adjunct'] },
  { id: 'aid', label: '🧪 Process aids', groups: ['aid'] },
];
const ICON: Record<BotanicalGroup, string> = { floral: '🌸', herb: '🌿', spice: '🫙', wood: '🪵', tannin: '🍂', adjunct: '✨', aid: '🧪' };

/** When it goes in, in plain words. */
export function whenText(sp: Spice): string {
  if (sp.addAt === 'pitch') return 'Add at pitch';
  if (sp.addAt === 'clearing') return 'Add when clearing';
  if (sp.group === 'tannin') return 'After fermentation · stays in';
  return `After fermentation · ${sp.contactDays[0]}–${sp.contactDays[1]} days`;
}

/** SPEC §31 — one place for every flavour and process addition, with search and categories. */
export function AdditionsPanel({ r, set, uh, a }: { r: Recipe; set: (p: Partial<Recipe>) => void; uh: UnitHelpers; a: Analysis | null }) {
  const V = a?.whole.volumeL ?? r.targetVolumeL;
  const [open, setOpen] = useState(r.spices.length === 0);
  const [cat, setCat] = useState<Cat>('all');
  const [q, setQ] = useState('');
  const used = new Set(r.spices.map((s) => s.spiceId));
  const list = useMemo(() => {
    const groups = CATS.find((c) => c.id === cat)!.groups;
    const term = q.trim().toLowerCase();
    // Typing searches everything, whatever tab is selected
    if (term) return SPICES.filter((s) => `${s.name} ${s.aroma} ${s.notes} ${s.group}`.toLowerCase().includes(term));
    return SPICES.filter((s) => groups.length === 0 || groups.includes(s.group));
  }, [cat, q]);
  const add = (sp: Spice) => {
    set({ spices: [...r.spices, { uid: uid(), spiceId: sp.id, grams: Number((sp.typical * V).toFixed(sp.typical * V < 10 ? 2 : 1)) }] });
    setOpen(false);
    setQ('');
  };

  return (
    <Card title="Flavour additions" icon="🌿" actions={!open ? <button type="button" className="btn-primary px-2.5 py-1 text-xs" onClick={() => setOpen(true)}>+ Add</button> : undefined}>
      <div className="flex flex-col gap-3">
        {r.spices.map((s, i) => {
          const sp = spiceById(s.spiceId);
          const gpl = V > 0 ? s.grams / V : 0;
          const upd = (p: Partial<typeof s>) => set({ spices: r.spices.map((x, j) => (j === i ? { ...x, ...p } : x)) });
          return (
            <div key={s.uid} className="rounded-lg border border-stone-200 p-2 dark:border-stone-800">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-lg" aria-hidden>{ICON[sp.group]}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-tight">{sp.name}</p>
                  <p className="text-xs text-stone-500">{whenText(sp)}{sp.aroma ? ` · ${sp.aroma}` : ''}</p>
                </div>
                <NumberField className="w-24" value={s.grams} onChange={(grams) => upd({ grams })} unit="g" step={0.1} decimals={2} />
                <RemoveButton label={`Remove ${sp.name}`} onClick={() => set({ spices: r.spices.filter((_, j) => j !== i) })} />
              </div>
              <DoseMeter bands={sp} dose={gpl} unit="g/L" extra={uh.u === 'imperial' ? `${(gpl * L_PER_GAL).toFixed(2)} g/gal` : undefined}
                tip={`${sp.notes}${sp.use ? ` ${sp.use}` : ''} Bands are practitioner consensus, so taste as you go.`} />
            </div>
          );
        })}
        {r.spices.length === 0 && !open && <p className="text-sm text-stone-500">Nothing added yet: a traditional mead needs nothing here.</p>}

        {open && (
          <div className="rounded-xl border border-honey-300 bg-honey-50/40 p-2 dark:border-honey-800 dark:bg-honey-900/10">
            <div className="mb-2 flex items-center gap-2">
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: oak, rose, tannin, vanilla…" aria-label="Search additions" className="min-w-0 flex-1" />
              <button type="button" className="btn-ghost text-xs" onClick={() => { setOpen(false); setQ(''); }}>Close</button>
            </div>
            <div className="-mx-1 mb-2 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Categories">
              {CATS.map((c) => (
                <button key={c.id} type="button" role="tab" aria-selected={!q.trim() && cat === c.id} onClick={() => { setCat(c.id); setQ(''); }}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${!q.trim() && cat === c.id ? 'bg-honey-500 font-semibold text-stone-950' : 'bg-white text-stone-600 dark:bg-stone-800 dark:text-stone-300'}`}>{c.label}</button>
              ))}
            </div>
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {list.map((sp) => (
                <li key={sp.id}>
                  <button type="button" onClick={() => add(sp)} className="flex w-full items-start gap-2 rounded-lg bg-white p-2 text-left hover:bg-honey-100 dark:bg-stone-900 dark:hover:bg-honey-900/30">
                    <span className="text-lg" aria-hidden>{ICON[sp.group]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{sp.name}{used.has(sp.id) && <span className="ml-1 text-xs text-stone-400">(added)</span>}</span>
                      <span className="block text-xs text-stone-500">{sp.aroma ? `${sp.aroma} · ` : ''}{whenText(sp)}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-stone-500"><b className="tabular text-stone-700 dark:text-stone-200">{(sp.typical * V).toFixed(sp.typical * V < 10 ? 1 : 0)} g</b><br />for {uh.fmtVol(V, 0)}</span>
                  </button>
                </li>
              ))}
              {list.length === 0 && <li className="p-2 text-sm text-stone-500">Nothing matches “{q}”.</li>}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
