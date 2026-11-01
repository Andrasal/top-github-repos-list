import { ReactNode, useEffect, useRef, useState } from 'react';
import type { UnitSystem } from '../lib/units';
import type { Detail } from './detail';

export type Theme = 'auto' | 'light' | 'dark';

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; t: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5">
      <span className="text-sm">{label}</span>
      <span className="flex rounded-md bg-stone-200 p-0.5 text-xs dark:bg-stone-800" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}
            className={`rounded px-2 py-0.5 font-medium ${value === o.v ? 'bg-white shadow dark:bg-stone-600' : 'text-stone-500'}`}>{o.t}</button>
        ))}
      </span>
    </div>
  );
}

const Item = ({ icon, children, onClick }: { icon: string; children: ReactNode; onClick: () => void }) => (
  <button type="button" role="menuitem" onClick={onClick} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800">
    <span aria-hidden className="w-5 text-center">{icon}</span>{children}
  </button>
);

/** SPEC §31 — everything that isn't part of the current step lives here, out of the way. */
export function AppMenu(p: {
  units: UnitSystem; setUnits: (u: UnitSystem) => void;
  detail: Detail; setDetail: (d: Detail) => void;
  guide: boolean; setGuide: (g: boolean) => void;
  theme: Theme; setTheme: (t: Theme) => void;
  onRecipes: () => void; onExport: () => void; onSaveNew?: () => void; onCalc: () => void; onSources: () => void; onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  const act = (f: () => void) => () => { setOpen(false); f(); };
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Menu" onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-300 text-lg leading-none hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800">⋯</button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-xl dark:border-stone-700 dark:bg-stone-900">
          <Item icon="📚" onClick={act(p.onRecipes)}>My recipes</Item>
          <Item icon="⬇️" onClick={act(p.onExport)}>Export to Excel / Sheets</Item>
          {p.onSaveNew && <Item icon="🆕" onClick={act(p.onSaveNew)}>Save as a new recipe</Item>}
          <div className="my-1 border-t border-stone-200 dark:border-stone-800" />
          <Seg label="Units" value={p.units} onChange={p.setUnits} options={[{ v: 'metric', t: 'Metric' }, { v: 'imperial', t: 'US' }]} />
          <Seg label="Detail" value={p.detail} onChange={p.setDetail} options={[{ v: 'simple', t: 'Simple' }, { v: 'expert', t: 'Expert' }]} />
          <Seg label="Beginner guide" value={p.guide ? 'on' : 'off'} onChange={(v) => p.setGuide(v === 'on')} options={[{ v: 'on', t: 'On' }, { v: 'off', t: 'Off' }]} />
          <Seg label="Theme" value={p.theme} onChange={p.setTheme} options={[{ v: 'auto', t: 'Auto' }, { v: 'light', t: '☀️' }, { v: 'dark', t: '🌙' }]} />
          <div className="my-1 border-t border-stone-200 dark:border-stone-800" />
          <Item icon="🧮" onClick={act(p.onCalc)}>ABV calculator</Item>
          <Item icon="📖" onClick={act(p.onSources)}>Sources & licences</Item>
          <Item icon="↺" onClick={act(p.onReset)}>Start over (clear the editor)</Item>
        </div>
      )}
    </div>
  );
}
