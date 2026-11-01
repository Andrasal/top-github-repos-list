import { useMemo, useState } from 'react';
import type { Recipe } from '../lib/recipe';
import { designForTarget, scaleRecipe } from '../lib/designer';
import { NumberField } from './ui';
import type { UnitHelpers } from './units';

const FINISHES = [
  { label: 'Dry', fg: 0.996 },
  { label: 'Off-dry', fg: 1.006 },
  { label: 'Semi-sweet', fg: 1.012 },
  { label: 'Sweet', fg: 1.02 },
  { label: 'Dessert', fg: 1.03 },
];

/** SPEC §19 — "Hit a target" and batch scaling. */
export function DesignerTools({ r, replace, uh }: { r: Recipe; replace: (r: Recipe) => void; uh: UnitHelpers }) {
  const [abv, setAbv] = useState(12);
  const [fg, setFg] = useState(1.012);
  const [newVol, setNewVol] = useState(r.targetVolumeL * 2);
  const [open, setOpen] = useState(false);
  // The solver runs ~60 analyses, so only while the tool is open
  const preview = useMemo(() => {
    if (!open) return null;
    try { return designForTarget(r, abv, fg); } catch { return null; }
  }, [r, abv, fg, open]);
  const currentHoney = r.honeys.reduce((a, h) => a + h.massKg, 0);
  return (
    <div className="mt-3 flex flex-col gap-3">
      <details onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)} className="rounded-lg border border-honey-200 bg-honey-50/60 p-3 dark:border-honey-900 dark:bg-honey-900/10">
        <summary className="cursor-pointer text-sm font-semibold">🎯 Hit a target ABV & sweetness</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NumberField label="Target ABV" value={abv} onChange={setAbv} unit="%" step={0.5} min={3} max={20} decimals={1} />
          <NumberField label="Finish (FG)" value={fg} onChange={setFg} step={0.001} min={0.99} max={1.06} decimals={3} />
          <div className="col-span-2 flex flex-wrap gap-1">
            {FINISHES.map((f) => (
              <button key={f.label} onClick={() => setFg(f.fg)} className={`btn-ghost px-2 py-0.5 text-xs ${Math.abs(fg - f.fg) < 1e-6 ? 'bg-honey-200 dark:bg-honey-800/50' : ''}`}>{f.label}</button>
            ))}
          </div>
        </div>
        {preview && (
          <div className="mt-3 space-y-2 text-sm">
            <p>
              You need OG <b className="tabular">{preview.requiredOg.toFixed(3)}</b>. That's <b className="tabular">{uh.fmtMass(preview.honeyKg)}</b> of honey
              {currentHoney > 0 && <> ({preview.honeyKg >= currentHoney ? '+' : ''}{uh.fmtMass(preview.honeyKg - currentHoney)} vs now)</>}, counting the sugar from your fruit.
            </p>
            {preview.notes.map((n) => <p key={n} className="text-xs text-stone-600 dark:text-stone-300">• {n}</p>)}
            <button className="btn-primary" onClick={() => replace(preview.recipe)}>Apply to recipe</button>
          </div>
        )}
      </details>
      <details className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
        <summary className="cursor-pointer text-sm font-semibold">↔️ Scale the batch</summary>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {[0.5, 2, 3].map((k) => (
            <button key={k} className="btn-ghost border border-stone-300 dark:border-stone-700" onClick={() => replace(scaleRecipe(r, k))}>×{k}</button>
          ))}
          <NumberField className="w-32" label="To volume" value={newVol} onChange={setNewVol} {...uh.vol} min={0.1} decimals={2} />
          <button className="btn-primary" onClick={() => replace(scaleRecipe(r, newVol / (r.mode === 'targetVolume' ? r.targetVolumeL : r.waterL || 1)))}>Scale</button>
        </div>
        <p className="mt-2 text-xs text-stone-500">Scales every ingredient, so OG, ABV and dose bands stay the same.</p>
      </details>
    </div>
  );
}
