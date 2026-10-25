import type { Recipe } from '../lib/recipe';
import { YEASTS, yeastById } from '../lib/db';
import { PROTOCOL_LABELS, Protocol } from '../lib/nutrients';
import type { NDemand } from '../lib/constants';
import { Card, NumberField, Select, Tip } from './ui';
import type { UnitHelpers } from './units';

export function BatchPanel({ r, set, uh }: { r: Recipe; set: (p: Partial<Recipe>) => void; uh: UnitHelpers }) {
  const yeast = yeastById(r.yeastId);
  return (
    <Card title="Batch & Yeast" icon="🧪">
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 flex flex-col gap-1">
          <span className="label">Recipe name</span>
          <input value={r.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <Select
          label="Volume mode"
          value={r.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'targetVolume', label: 'Target must volume' },
            { value: 'fixedWater', label: 'Fixed water added' },
          ]}
        />
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
        <Select
          label="Yeast"
          className="col-span-2"
          value={r.yeastId}
          onChange={(yeastId) => set({ yeastId })}
          options={YEASTS.map((y) => ({ value: y.id, label: `${y.name} — ${y.tolerance}% · N ${y.nDemand}` }))}
        />
        <p className="col-span-2 -mt-1 text-xs text-stone-500 dark:text-stone-400">
          {yeast.notes} Temp {yeast.tempC[0]}–{yeast.tempC[1]} °C.
        </p>
        <Select<NDemand | 'auto'>
          label="N demand"
          value={r.nDemandOverride ?? 'auto'}
          onChange={(v) => set({ nDemandOverride: v === 'auto' ? null : v })}
          options={[
            { value: 'auto', label: `Strain default (${yeast.nDemand})` },
            { value: 'low', label: 'Low (×0.75)' },
            { value: 'medium', label: 'Medium (×0.90)' },
            { value: 'high', label: 'High (×1.25)' },
            { value: 'veryHigh', label: 'Very high (×1.50)' },
          ]}
        />
        <Select<Protocol>
          label="Nutrient protocol"
          value={r.protocol}
          onChange={(protocol) => set({ protocol })}
          options={(Object.keys(PROTOCOL_LABELS) as Protocol[]).map((p) => ({ value: p, label: PROTOCOL_LABELS[p] }))}
        />
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={r.creditFruitYan} onChange={(e) => set({ creditFruitYan: e.target.checked })} />
          Credit YAN from primary fruit
          <Tip>Off by default: fruit YAN varies ±50 % by cultivar and ripeness. Honey is treated as 0 YAN (SPEC §7.1).</Tip>
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={r.targetFg != null} onChange={(e) => set({ targetFg: e.target.checked ? 1.012 : null })} />
          Stop / back-sweeten to a target FG
          <Tip>Use when you'll stabilise and back-sweeten, or stop fermentation early. A target lower than the yeast can reach is ignored (SPEC §6.1).</Tip>
        </label>
        {r.targetFg != null && (
          <NumberField label="Target FG" value={r.targetFg} onChange={(v) => set({ targetFg: v })} step={0.001} min={0.99} max={1.2} decimals={3} />
        )}
        <NumberField
          label="Dry FG baseline"
          value={r.dryFg}
          onChange={(v) => set({ dryFg: v })}
          step={0.001}
          min={0.985}
          max={1.005}
          decimals={3}
          hint="Terminal gravity of a fully dry mead. Ethanol is lighter than water, so dry meads read ~0.994–0.998 (SPEC §2.2)."
        />
      </div>
    </Card>
  );
}
