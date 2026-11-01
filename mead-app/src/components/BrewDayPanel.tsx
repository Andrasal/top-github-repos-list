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
  // The first phase with anything left to do opens; finished phases fold away
  const currentPhase = phases.find((ph) => steps.some((x) => x.phase === ph && !done.has(x.id))) ?? phases[phases.length - 1];
  const next = steps.find((x) => !done.has(x.id));
  return (
    <Card title="Brew-day checklist" icon="✅" actions={count > 0 ? <button type="button" className="btn-ghost text-xs" onClick={() => set({ brewDay: { done: [] } })}>Clear ticks</button> : undefined}>
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-xs text-stone-500"><span>{count} of {steps.length} done</span><span>{pct.toFixed(0)} %</span></div>
        {next && <p className="mb-2 rounded-lg bg-honey-50 p-2 text-sm dark:bg-honey-900/20"><span className="label">Next up</span><br />{next.text}</p>}
        <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-honey-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {phases.map((ph) => {
        const items = steps.filter((x) => x.phase === ph);
        const left = items.filter((x) => !done.has(x.id)).length;
        return (
          <details key={ph} open={ph === currentPhase} className="mb-2 rounded-lg border border-stone-200 last:mb-0 dark:border-stone-800">
            <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold">
              <span>{left === 0 ? '✅ ' : ph === currentPhase ? '👉 ' : ''}{PHASE_LABEL[ph]}</span>
              <span className="text-xs font-normal text-stone-500">{items.length - left}/{items.length}</span>
            </summary>
            <ul className="space-y-1 px-1 pb-2">
              {items.map((x) => {
                const on = done.has(x.id);
                return (
                  <li key={x.id}>
                    <label className={`flex cursor-pointer gap-2 rounded-lg p-2 text-sm ${on ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-stone-50 dark:hover:bg-stone-800/50'}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(x.id)} className="mt-0.5 h-4 w-4 shrink-0 accent-honey-500" />
                      <span>
                        <span className={on ? 'text-stone-500 line-through' : ''}>{x.text}</span>
                        {x.detail && <span className="block text-xs text-stone-500">{x.detail}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </Card>
  );
}
