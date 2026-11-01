import { useId } from 'react';
import type { Analysis } from '../lib/recipe';
import { caloriesPerServing } from '../lib/cellar';
import { brewDaySteps } from '../lib/brewday';
import { fruitById, honeyById, spiceById } from '../lib/db';
import { Card } from './ui';
import type { UnitHelpers } from './units';

/** A glass of the predicted colour, with a gentle fizz. */
export function GlassSvg({ color, size = 96, fill = 0.72 }: { color: string; size?: number; fill?: number }) {
  const top = 18 + (1 - fill) * 70;
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 80 100" role="img" aria-label="Predicted colour in the glass">
      <defs>
        <clipPath id={`bowl${id}`}><path d="M14 8 H66 C66 50 56 62 40 64 C24 62 14 50 14 8 Z" /></clipPath>
        <linearGradient id={`shine${id}`} x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.35" /><stop offset="0.4" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>
      <g clipPath={`url(#bowl${id})`}>
        <rect x="0" y={top} width="80" height="100" fill={color} />
        <rect x="0" y={top} width="80" height="3" fill="#fff" opacity="0.35" />
        <circle className="mead-bubble" cx="34" cy="58" r="1.4" fill="#fff" opacity="0.6" />
        <circle className="mead-bubble mead-bubble-2" cx="45" cy="60" r="1" fill="#fff" opacity="0.6" />
        <circle className="mead-bubble mead-bubble-3" cx="40" cy="62" r="1.2" fill="#fff" opacity="0.6" />
        <rect x="0" y="0" width="80" height="100" fill={`url(#shine${id})`} />
      </g>
      <path d="M14 8 H66 C66 50 56 62 40 64 C24 62 14 50 14 8 Z" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
      <path d="M40 64 V88 M26 92 H54" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

const Fact = ({ k, v }: { k: string; v: string }) => (<><dt className="text-stone-500">{k}</dt><dd className="tabular text-right font-medium">{v}</dd></>);

/** Bottling summary: the finished mead at a glance, plus export / print / save. */
export function BottlePanel({ a, uh, onExport, onSave, saveLabel }: { a: Analysis; uh: UnitHelpers; onExport: () => void; onSave: () => void; saveLabel: string }) {
  const kcal = caloriesPerServing(a.abv, a.residualSugarGPerL, 150);
  const yieldL = a.occupancy.recoveredL + (a.whole.volumeL - a.primary.volumeL);
  return (
    <Card title="Bottle & share" icon="🍾">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center text-stone-400">
          <GlassSvg color={a.color.hex} size={110} />
          <span className="mt-1 text-xs text-stone-500">{a.color.name}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-semibold">{a.recipe.name}</p>
          <p className="mt-1 text-sm italic text-stone-600 dark:text-stone-300">{a.tastingNote}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <Fact k="ABV" v={`${a.abv.toFixed(1)} %`} />
            <Fact k="OG → FG" v={`${a.og.toFixed(3)} → ${a.fg.fg.toFixed(3)}`} />
            <Fact k="Sweetness" v={`${a.sweetness}, ~${a.residualSugarGPerL.toFixed(0)} g/L`} />
            <Fact k="pH (predicted)" v={a.ph.finishedPh.toFixed(2)} />
            <Fact k="Yield" v={uh.fmtVol(yieldL)} />
            <Fact k="Calories" v={`≈ ${kcal.toFixed(0)} kcal / 150 mL`} />
          </dl>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        {a.bottles.map((b) => (
          <div key={b.sizeL} className="rounded-lg bg-stone-100 p-2 dark:bg-stone-800/60">
            <div className="tabular text-lg font-semibold">{b.count}</div>
            <div className="text-[11px] text-stone-500">× {(b.sizeL * 1000).toFixed(0)} mL</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={onSave}>💾 {saveLabel}</button>
        <button type="button" className="btn-ghost border border-stone-300 dark:border-stone-700" onClick={onExport}>⬇️ Excel / Sheets</button>
        <button type="button" className="btn-ghost border border-stone-300 dark:border-stone-700" onClick={() => window.print()}>🖨️ Print cellar sheet</button>
      </div>
    </Card>
  );
}

/** Printer-only one-page cellar sheet (hidden on screen). */
export function PrintSheet({ a, uh, versionLabel }: { a: Analysis; uh: UnitHelpers; versionLabel?: string }) {
  const r = a.recipe;
  const steps = brewDaySteps(a, { vol: (l) => uh.fmtVol(l), mass: (kg) => uh.fmtMass(kg) });
  const done = new Set(r.brewDay?.done ?? []);
  return (
    <div className="print-sheet hidden text-[11pt] text-black">
      <h1 className="font-display text-2xl font-bold">{r.name}</h1>
      <p className="text-sm">{versionLabel ?? 'Unsaved recipe'} · printed {new Date().toLocaleDateString()} · Mead Lab</p>
      <table className="mt-3 w-full border-collapse text-sm">
        <tbody>
          {[
            ['Batch', `${uh.fmtVol(a.primary.volumeL)} must · water ${uh.fmtVol(a.primary.waterL)} · fermenter ≥ ${uh.fmtVol(a.occupancy.recommendedFermenterL)}`],
            ['Gravity', `OG ${a.og.toFixed(3)} → FG ${a.fg.fg.toFixed(3)} · ⅓ break ${a.breaks.oneThird.toFixed(3)}`],
            ['Strength', `${a.abv.toFixed(2)} % ABV (Alternative equation) · ${a.sweetness}`],
            ['Honey', r.honeys.filter((h) => h.massKg > 0).map((h) => `${uh.fmtMass(h.massKg)} ${honeyById(h.honeyId).name}`).join(', ') || '—'],
            ['Fruit', r.fruits.filter((f) => f.massKg > 0).map((f) => `${uh.fmtMass(f.massKg)} ${fruitById(f.fruitId).name} (${f.stage})`).join(', ') || '—'],
            ['Botanicals', r.spices.filter((s) => s.grams > 0).map((s) => `${s.grams.toFixed(1)} g ${spiceById(s.spiceId).name}`).join(', ') || '—'],
            ['Yeast', `${a.yeast.name}: ${a.rehydration.yeastG.toFixed(1)} g + ${a.rehydration.goFermG.toFixed(1)} g Go-Ferm`],
            ['pH', `must ${a.ph.mustPh.toFixed(2)} → finished ${a.ph.finishedPh.toFixed(2)} (predicted)`],
          ].map(([k, v]) => (
            <tr key={k}><th className="w-28 border border-black/30 p-1 text-left align-top">{k}</th><td className="border border-black/30 p-1">{v}</td></tr>
          ))}
        </tbody>
      </table>
      <h2 className="mt-4 text-lg font-bold">Steps</h2>
      <ol className="mt-1 space-y-0.5 text-sm">
        {steps.map((s) => <li key={s.id}>{done.has(s.id) ? '☑' : '☐'} {s.text}</li>)}
      </ol>
      <h2 className="mt-4 text-lg font-bold">Gravity log</h2>
      <table className="mt-1 w-full border-collapse text-sm">
        <thead><tr>{['Date', 'SG', 'Temp', 'Notes'].map((h) => <th key={h} className="border border-black/30 p-1 text-left">{h}</th>)}</tr></thead>
        <tbody>
          {r.log.readings.map((x) => <tr key={x.uid}><td className="border border-black/30 p-1">{new Date(x.at).toLocaleDateString()}</td><td className="border border-black/30 p-1">{x.sg.toFixed(3)}</td><td className="border border-black/30 p-1" /><td className="border border-black/30 p-1">{x.note}</td></tr>)}
          {Array.from({ length: Math.max(4, 10 - r.log.readings.length) }).map((_, i) => <tr key={i}><td className="h-7 border border-black/30" /><td className="border border-black/30" /><td className="border border-black/30" /><td className="border border-black/30" /></tr>)}
        </tbody>
      </table>
    </div>
  );
}
