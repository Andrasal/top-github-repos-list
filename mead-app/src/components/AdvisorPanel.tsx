import type { Analysis } from '../lib/recipe';
import type { Severity } from '../lib/flavor';
import { TA_TARGETS } from '../lib/flavor';
import { Card, Cite } from './ui';

const SEV: Record<Severity, { icon: string; cls: string }> = {
  error: { icon: '⛔', cls: 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40' },
  warning: { icon: '⚠️', cls: 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40' },
  tip: { icon: '💡', cls: 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' },
  info: { icon: 'ℹ️', cls: 'border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900' },
};

export function AdvisorPanel({ a, onAddSpice, onAddFruit }: { a: Analysis; onAddSpice: (id: string, gPerL: number) => void; onAddFruit: (id: string) => void }) {
  const [taMin, taMax] = TA_TARGETS[a.sweetness];
  return (
    <Card title="Mead Maker's Brain" icon="🧠">
      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-stone-100 p-2 dark:bg-stone-800/60">
          <div className="label">Fruit load</div>
          <div className="tabular text-base font-semibold">{a.fruitLoad.toFixed(2)} kg/L</div>
        </div>
        <div className="rounded-lg bg-stone-100 p-2 dark:bg-stone-800/60">
          <div className="label">Est. TA</div>
          <div className="tabular text-base font-semibold">{a.ta.toFixed(1)} g/L</div>
          <div className="text-stone-500">target {taMin}–{taMax}</div>
        </div>
        <div className="rounded-lg bg-stone-100 p-2 dark:bg-stone-800/60">
          <div className="label">Style</div>
          <div className="text-base font-semibold capitalize">{a.sweetness}</div>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {a.advisories.map((x) => (
          <li key={x.id} className={`rounded-lg border p-2.5 text-sm ${SEV[x.severity].cls}`}>
            <div className="flex items-start gap-2">
              <span aria-label={x.severity}>{SEV[x.severity].icon}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{x.title}</div>
                <div className="text-stone-700 dark:text-stone-300">{x.detail}</div>
                {x.suggestion && <div className="mt-1 text-stone-900 dark:text-stone-100">→ {x.suggestion}</div>}
                <div className="mt-1"><Cite ids={x.source} /></div>
              </div>
            </div>
          </li>
        ))}
        {a.advisories.length === 0 && <li className="text-sm text-stone-500">No issues found — balanced recipe.</li>}
      </ul>
      {a.suggestions.length > 0 && (
        <div className="mt-4">
          <h3 className="label mb-2">Pairing ideas</h3>
          <ul className="flex flex-col gap-1.5">
            {a.suggestions.map((s) => (
              <li key={s.forId + s.partnerId} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <b>{s.forName}</b> + {s.partnerName}
                  <span className="block text-xs text-stone-500">{s.note}{s.startDoseGPerL != null && ` Start at ${s.startDoseGPerL} g/L.`}</span>
                </span>
                <button
                  className="btn-ghost shrink-0 text-honey-700 dark:text-honey-300"
                  onClick={() => (s.startDoseGPerL != null ? onAddSpice(s.partnerId, s.startDoseGPerL) : onAddFruit(s.partnerId))}
                >
                  + Add
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
