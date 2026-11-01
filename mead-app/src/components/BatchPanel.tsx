import { useState } from 'react';
import type { Recipe } from '../lib/recipe';
import { VESSELS } from '../lib/cellar';
import { ExpertOnly } from './detail';
import { Card, NumberField, Select, Tip } from './ui';
import type { UnitHelpers } from './units';
import { DesignerTools } from './DesignerTools';

export function BatchPanel({ r, set, replace, uh }: { r: Recipe; set: (p: Partial<Recipe>) => void; replace: (r: Recipe) => void; uh: UnitHelpers }) {
  const [pro, setPro] = useState(r.targetVolumeL > 60);
  return (
    <Card title="Batch size & finish" icon="🪣">
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 flex flex-col gap-1">
          <span className="label">Name your mead</span>
          <input value={r.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <ExpertOnly><Select
          label="Volume mode"
          value={r.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'targetVolume', label: 'Target must volume' },
            { value: 'fixedWater', label: 'Fixed water added' },
          ]}
        /></ExpertOnly>
        {r.mode === 'targetVolume' ? (
          <NumberField
            label="Must volume"
            value={r.targetVolumeL}
            onChange={(v) => set({ targetVolumeL: Math.max(0.1, v) })}
            {...uh.vol}
            min={0.1}
            decimals={2}
            hint="Liquid volume after fruit has released its juice — what you'd read OG from. Water is solved automatically by mass balance (SPEC §5.2)."
          />
        ) : (
          <NumberField label="Water added" value={r.waterL} onChange={(v) => set({ waterL: v })} {...uh.vol} decimals={2} hint="Volume and OG are derived from the water you add (SPEC §5.2 fixed-water mode)." />
        )}
        {r.mode === 'targetVolume' && (
          <div className="col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="label">Quick sizes</span>
              <span className="flex rounded-md bg-stone-200 p-0.5 text-xs dark:bg-stone-800" role="group" aria-label="Batch scale">
                {([false, true] as const).map((v) => (
                  <button key={String(v)} type="button" aria-pressed={pro === v} onClick={() => setPro(v)} className={`rounded px-2 py-0.5 ${pro === v ? 'bg-white shadow dark:bg-stone-600' : 'text-stone-500'}`}>{v ? 'Commercial' : 'Home'}</button>
                ))}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {VESSELS.filter((x) => (x.scale === 'pro') === pro).map((x) => (
                <button key={x.label} type="button" onClick={() => set({ targetVolumeL: Number(x.litres.toFixed(3)) })}
                  className={`rounded-full border px-2.5 py-1 text-xs ${Math.abs(r.targetVolumeL - x.litres) < 0.01 ? 'border-honey-500 bg-honey-100 font-semibold dark:bg-honey-900/40' : 'border-stone-300 hover:bg-honey-50 dark:border-stone-700 dark:hover:bg-honey-900/20'}`}>
                  {x.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-stone-500">This is the must volume. Pick a fermenter about 20–30 % bigger; the Brew day step tells you the size.</p>
          </div>
        )}
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={r.targetFg != null} onChange={(e) => set({ targetFg: e.target.checked ? 1.012 : null })} />
          I’ll stop it or sweeten it to a set finish
          <Tip>Use when you'll stabilise and back-sweeten, or stop fermentation early. A target lower than the yeast can reach is ignored (SPEC §6.1).</Tip>
        </label>
        {r.targetFg != null && (
          <NumberField label="Target FG" value={r.targetFg} onChange={(v) => set({ targetFg: v })} step={0.001} min={0.99} max={1.2} decimals={3} />
        )}
        <ExpertOnly><NumberField
          label="Dry FG baseline"
          value={r.dryFg}
          onChange={(v) => set({ dryFg: v })}
          step={0.001}
          min={0.985}
          max={1.005}
          decimals={3}
          hint="Terminal gravity of a fully dry mead. Ethanol is lighter than water, so dry meads read ~0.994–0.998 (SPEC §2.2)."
        /></ExpertOnly>
      </div>
      <DesignerTools r={r} replace={replace} uh={uh} />
    </Card>
  );
}
