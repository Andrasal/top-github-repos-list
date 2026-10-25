import type { Recipe } from '../lib/recipe';
import { FRUITS, HONEYS, SPICES, SUGARS, fruitById, honeyById, spiceById, SugarId } from '../lib/db';
import { spiceBand } from '../lib/flavor';
import type { Analysis } from '../lib/recipe';
import { L_PER_GAL } from '../lib/units';
import { Card, Cite, NumberField, RemoveButton, Select, Tip } from './ui';
import { uid, UnitHelpers } from './units';

type Setter = (p: Partial<Recipe>) => void;

function Contribution({ a, k }: { a: Analysis; k: string }) {
  const c = a.contributions.find((x) => x.key === k);
  if (!c) return null;
  return (
    <span className="tabular text-xs text-stone-500 dark:text-stone-400">
      +{c.deltaPoints.toFixed(1)} pts · {c.pkl.toFixed(0)} PKL / {c.ppg.toFixed(1)} PPG
      {c.kind === 'fruit' && ` · displaces ${c.displacedWaterL.toFixed(2)} L water`}
    </span>
  );
}

export function FermentablesPanel({ r, set, uh, a }: { r: Recipe; set: Setter; uh: UnitHelpers; a: Analysis | null }) {
  return (
    <Card
      title="Honey & Sugars"
      icon="🍯"
      actions={
        <div className="flex gap-1">
          <button className="btn-ghost" onClick={() => set({ honeys: [...r.honeys, { uid: uid(), honeyId: 'wildflower', massKg: 1 }] })}>+ Honey</button>
          <button className="btn-ghost" onClick={() => set({ sugars: [...r.sugars, { uid: uid(), sugarId: 'sucrose', massKg: 0.5 }] })}>+ Sugar</button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {r.honeys.map((h, i) => {
          const hon = honeyById(h.honeyId);
          return (
            <div key={h.uid} className="rounded-lg border border-stone-200 p-2 dark:border-stone-800">
              <div className="flex items-end gap-2">
                <Select className="flex-1" label="Honey" value={h.honeyId} onChange={(honeyId) => set({ honeys: r.honeys.map((x, j) => (j === i ? { ...x, honeyId } : x)) })} options={HONEYS.map((x) => ({ value: x.id, label: x.name }))} />
                <NumberField className="w-28" label="Mass" value={h.massKg} onChange={(massKg) => set({ honeys: r.honeys.map((x, j) => (j === i ? { ...x, massKg } : x)) })} {...uh.mass} step={0.1} decimals={2} />
                <RemoveButton label="Remove honey" onClick={() => set({ honeys: r.honeys.filter((_, j) => j !== i) })} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                {a && <Contribution a={a} k={h.uid} />}
                <span className="text-xs text-stone-500">ρ {hon.density} kg/L · ≈ {uh.fmtVol(h.massKg / hon.density)} of honey</span>
                <Tip>{hon.character}</Tip>
              </div>
            </div>
          );
        })}
        {r.sugars.map((s, i) => (
          <div key={s.uid} className="rounded-lg border border-stone-200 p-2 dark:border-stone-800">
            <div className="flex items-end gap-2">
              <Select<SugarId> className="flex-1" label="Sugar" value={s.sugarId} onChange={(sugarId) => set({ sugars: r.sugars.map((x, j) => (j === i ? { ...x, sugarId } : x)) })} options={SUGARS.map((x) => ({ value: x.id, label: x.name }))} />
              <NumberField className="w-28" label="Mass" value={s.massKg} onChange={(massKg) => set({ sugars: r.sugars.map((x, j) => (j === i ? { ...x, massKg } : x)) })} {...uh.mass} decimals={2} />
              <RemoveButton label="Remove sugar" onClick={() => set({ sugars: r.sugars.filter((_, j) => j !== i) })} />
            </div>
            {a && <Contribution a={a} k={s.uid} />}
          </div>
        ))}
        {r.honeys.length + r.sugars.length === 0 && <p className="text-sm text-stone-500">Add a honey to begin.</p>}
      </div>
    </Card>
  );
}

export function FruitPanel({ r, set, uh, a }: { r: Recipe; set: Setter; uh: UnitHelpers; a: Analysis | null }) {
  return (
    <Card
      title="Fruit (Melomel)"
      icon="🍒"
      actions={<button className="btn-ghost" onClick={() => set({ fruits: [...r.fruits, { uid: uid(), fruitId: 'raspberry', massKg: 1, stage: 'primary' }] })}>+ Fruit</button>}
    >
      <div className="flex flex-col gap-3">
        {r.fruits.map((f, i) => {
          const fr = fruitById(f.fruitId);
          const upd = (p: Partial<typeof f>) => set({ fruits: r.fruits.map((x, j) => (j === i ? { ...x, ...p } : x)) });
          return (
            <div key={f.uid} className="rounded-lg border border-stone-200 p-2 dark:border-stone-800">
              <div className="flex flex-wrap items-end gap-2">
                <Select className="min-w-[9rem] flex-1" label="Fruit" value={f.fruitId} onChange={(fruitId) => upd({ fruitId })} options={FRUITS.map((x) => ({ value: x.id, label: x.name }))} />
                <NumberField className="w-24" label="Mass" value={f.massKg} onChange={(massKg) => upd({ massKg })} {...uh.mass} decimals={2} />
                <Select className="w-28" label="Stage" value={f.stage} onChange={(stage) => upd({ stage })} options={[{ value: 'primary', label: 'Primary' }, { value: 'secondary', label: 'Secondary' }]} />
                <RemoveButton label="Remove fruit" onClick={() => set({ fruits: r.fruits.filter((_, j) => j !== i) })} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                <span className="tabular">{fr.brix} °Bx · TA {fr.ta} g/L ({fr.acid}) · pH {fr.ph} · tannin {'●'.repeat(fr.tannin) || '–'}</span>
                {a && f.stage === 'primary' && <Contribution a={a} k={f.uid} />}
                {f.stage === 'secondary' && <span>Excluded from measured OG; counted in effective OG (SPEC §5.6)</span>}
                <Tip>{fr.notes} Juice soluble fraction {(1 - fr.insoluble) * 100}%, retains ~{fr.retention} L/kg in pulp.</Tip>
                <Cite ids={fr.source} />
              </div>
            </div>
          );
        })}
        {r.fruits.length === 0 && <p className="text-sm text-stone-500">No fruit — this is a traditional (show) mead.</p>}
      </div>
    </Card>
  );
}

const BAND_STYLE: Record<string, string> = {
  imperceptible: 'bg-stone-300 text-stone-700',
  subtle: 'bg-emerald-200 text-emerald-900',
  typical: 'bg-emerald-400 text-emerald-950',
  bold: 'bg-amber-300 text-amber-950',
  assertive: 'bg-orange-400 text-orange-950',
  astronomical: 'bg-red-500 text-white',
  'unit-error': 'bg-red-700 text-white',
};

export function SpicePanel({ r, set, uh, a }: { r: Recipe; set: Setter; uh: UnitHelpers; a: Analysis | null }) {
  const V = a?.whole.volumeL ?? r.targetVolumeL;
  return (
    <Card
      title="Spices & Adjuncts (Metheglin)"
      icon="🌿"
      actions={<button className="btn-ghost" onClick={() => set({ spices: [...r.spices, { uid: uid(), spiceId: 'cinnamon', grams: Number((0.6 * V).toFixed(1)) }] })}>+ Spice</button>}
    >
      <div className="flex flex-col gap-3">
        {r.spices.map((s, i) => {
          const sp = spiceById(s.spiceId);
          const gpl = V > 0 ? s.grams / V : 0;
          const band = spiceBand(sp, gpl);
          const pct = Math.min(100, (gpl / sp.max) * 100);
          const upd = (p: Partial<typeof s>) => set({ spices: r.spices.map((x, j) => (j === i ? { ...x, ...p } : x)) });
          return (
            <div key={s.uid} className="rounded-lg border border-stone-200 p-2 dark:border-stone-800">
              <div className="flex items-end gap-2">
                <Select className="flex-1" label="Spice" value={s.spiceId} onChange={(spiceId) => upd({ spiceId })} options={SPICES.map((x) => ({ value: x.id, label: x.name }))} />
                <NumberField className="w-28" label="Amount" value={s.grams} onChange={(grams) => upd({ grams })} unit="g" step={0.1} decimals={2} />
                <RemoveButton label="Remove spice" onClick={() => set({ spices: r.spices.filter((_, j) => j !== i) })} />
              </div>
              <div className="mt-2">
                <div className="relative h-2 rounded-full bg-gradient-to-r from-stone-200 via-emerald-300 via-60% to-red-400 dark:from-stone-700">
                  <div className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded bg-stone-900 dark:bg-white" style={{ left: `calc(${pct}% - 2px)` }} aria-hidden />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                  <span className={`rounded px-1.5 py-0.5 font-medium ${BAND_STYLE[band]}`}>{band}</span>
                  <span className="tabular">
                    {gpl.toFixed(3)} g/L{uh.u === 'imperial' && ` (${(gpl * L_PER_GAL).toFixed(2)} g/gal)`} · subtle {sp.subtle} · typical {sp.typical} · bold {sp.bold} · max {sp.max} g/L
                  </span>
                  <Tip>{sp.notes} Contact {sp.contactDays[0]}–{sp.contactDays[1]} days ({sp.form}). Bands are practitioner consensus — taste as you go.</Tip>
                </div>
              </div>
            </div>
          );
        })}
        {r.spices.length === 0 && <p className="text-sm text-stone-500">No spices. Check the Mead Maker's Brain for pairing ideas.</p>}
      </div>
    </Card>
  );
}
