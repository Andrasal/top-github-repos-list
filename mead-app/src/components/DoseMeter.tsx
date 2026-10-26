import type { DoseBands } from '../lib/db';
import { doseBand } from '../lib/flavor';
import { Tip } from './ui';

export const BAND_STYLE: Record<string, string> = {
  imperceptible: 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200',
  subtle: 'bg-emerald-200 text-emerald-900',
  typical: 'bg-emerald-400 text-emerald-950',
  bold: 'bg-amber-300 text-amber-950',
  assertive: 'bg-orange-400 text-orange-950',
  astronomical: 'bg-red-500 text-white',
  'unit-error': 'bg-red-700 text-white',
};

/** Shared dose meter for spices, flowers (g/L) and fruit (kg/L) — SPEC §17. */
export function DoseMeter({ bands, dose, unit, tip, extra }: { bands: DoseBands; dose: number; unit: string; tip?: string; extra?: string }) {
  const band = doseBand(bands, dose);
  // Scale so `max` sits at 85 % of the track; anything beyond pins to the end
  const pos = (v: number) => Math.min(100, (v / bands.max) * 85);
  const fmt = (v: number) => (v < 0.1 ? v.toFixed(3) : v < 10 ? v.toFixed(2) : v.toFixed(1));
  return (
    <div className="mt-2">
      <div className="relative h-2 rounded-full bg-stone-200 dark:bg-stone-700" role="meter" aria-valuemin={0} aria-valuemax={bands.max} aria-valuenow={dose} aria-label={`Dose ${fmt(dose)} ${unit}, ${band}`}>
        <div className="absolute inset-y-0 rounded-full bg-emerald-300/80 dark:bg-emerald-700/70" style={{ left: `${pos(bands.subtle)}%`, width: `${pos(bands.typical) - pos(bands.subtle)}%` }} />
        <div className="absolute inset-y-0 bg-emerald-500/80" style={{ left: `${pos(bands.typical)}%`, width: `${pos(bands.bold) - pos(bands.typical)}%` }} />
        <div className="absolute inset-y-0 bg-amber-400/80" style={{ left: `${pos(bands.bold)}%`, width: `${pos(bands.max) - pos(bands.bold)}%` }} />
        <div className="absolute inset-y-0 rounded-r-full bg-red-400/70" style={{ left: `${pos(bands.max)}%`, right: 0 }} />
        <div className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded bg-stone-900 shadow dark:bg-white" style={{ left: `calc(${pos(dose)}% - 2px)` }} aria-hidden />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
        <span className={`rounded px-1.5 py-0.5 font-medium ${BAND_STYLE[band]}`}>{band === 'unit-error' ? 'check units' : band}</span>
        <span className="tabular">{fmt(dose)} {unit}{extra ? ` (${extra})` : ''} · typical {bands.typical} · bold {bands.bold} · max {bands.max}</span>
        {tip && <Tip>{tip}</Tip>}
      </div>
    </div>
  );
}
