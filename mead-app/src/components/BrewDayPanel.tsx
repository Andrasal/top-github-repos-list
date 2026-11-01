import { useMemo } from 'react';
import type { Analysis, Recipe } from '../lib/recipe';
import { brewDaySteps, PHASE_LABEL, type Phase } from '../lib/brewday';
import { Card } from './ui';
import type { UnitHelpers } from './units';

/** Recipe-specific checklist; ticks are saved with the recipe (SPEC §28). */
export function BrewDayPanel({ a, r, set, uh }: { a: Analysis; r: Recipe; set: (p: Partial<Recipe>) => void; uh: UnitHelpers }) {
  const steps = useMemo(() => brewDaySteps(a, { vol: (l) => uh.fmtVol(l), mass: (kg) => uh.fmtMass(kg) }), [a, uh]);
  const done = new Set(r.brewDay?.done ?? []);
  const count = steps.filter((s) => done.has(s.id)).length;
  const toggle = (id: string) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id); else next.add(id);
    set({ brewDay: { done: [...next] } });
  };
  const phases = [...new Set(steps.map((s) => s.phase))] as Phase[];
  const pct = steps.length ? (count / steps.length) * 100 : 0;
  return (
    <Card title="Brew-day checklist" icon="✅" actions={count > 0 ? <button type="button" className="btn-ghost text-xs" onClick={() => set({ brewDay: { done: [] } })}>Clear ticks</button> : undefined}>
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-xs text-stone-500"><span>{count} of {steps.length} done</span><span>{pct.toFixed(0)} %</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-honey-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {phases.map((ph) => (
        <div key={ph} className="mb-3 last:mb-0">
          <h3 className="label mb-1">{PHASE_LABEL[ph]}</h3>
          <ul className="space-y-1">
            {steps.filter((s) => s.phase === ph).map((s) => {
              const on = done.has(s.id);
              return (
                <li key={s.id}>
                  <label className={`flex cursor-pointer gap-2 rounded-lg p-2 text-sm ${on ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-stone-50 dark:hover:bg-stone-800/50'}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(s.id)} className="mt-0.5 h-4 w-4 shrink-0 accent-honey-500" />
                    <span>
                      <span className={on ? 'text-stone-500 line-through' : ''}>{s.text}</span>
                      {s.detail && <span className="block text-xs text-stone-500">{s.detail}</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </Card>
  );
}
