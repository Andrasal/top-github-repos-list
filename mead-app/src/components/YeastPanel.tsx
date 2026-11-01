import { useMemo, useState } from 'react';
import type { Recipe } from '../lib/recipe';
import { YEASTS, yeastById } from '../lib/db';
import { PROTOCOL_LABELS, Protocol } from '../lib/nutrients';
import type { NDemand } from '../lib/constants';
import { Card, Select, Tip } from './ui';

const N_LABEL: Record<NDemand, string> = { low: 'Low N', medium: 'Medium N', high: 'High N', veryHigh: 'Very high N' };
const N_TONE: Record<NDemand, string> = {
  low: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  medium: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  high: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  veryHigh: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
};

/** Yeast catalog with maker / nitrogen filters, plus the nutrient settings that depend on the strain. */
export function YeastPanel({ r, set, abvDry }: { r: Recipe; set: (p: Partial<Recipe>) => void; abvDry: number | null }) {
  const [maker, setMaker] = useState('all');
  const [n, setN] = useState<'all' | NDemand>('all');
  const [showAll, setShowAll] = useState(false);
  const yeast = yeastById(r.yeastId);
  const makers = useMemo(() => [...new Set(YEASTS.map((y) => y.maker))], []);
  const list = YEASTS.filter((y) => (maker === 'all' || y.maker === maker) && (n === 'all' || y.nDemand === n));
  const shown = showAll || maker !== 'all' || n !== 'all' ? list : list.slice(0, 6);
  if (!shown.some((y) => y.id === yeast.id) && list.some((y) => y.id === yeast.id)) shown.unshift(yeast);

  return (
    <Card title={`Yeast (${YEASTS.length} strains)`} icon="🧬">
      <div className="mb-2 flex flex-wrap gap-2">
        <Select label="Maker" value={maker} onChange={setMaker} options={[{ value: 'all', label: 'All makers' }, ...makers.map((m) => ({ value: m, label: m }))]} className="flex-1" />
        <Select<'all' | NDemand> label="Nitrogen need" value={n} onChange={setN} options={[{ value: 'all', label: 'Any' }, ...(Object.keys(N_LABEL) as NDemand[]).map((k) => ({ value: k, label: N_LABEL[k] }))]} className="flex-1" />
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label="Yeast strain">
        {shown.map((y) => {
          const on = y.id === r.yeastId;
          return (
            <li key={y.id}>
              <button type="button" role="radio" aria-checked={on} onClick={() => set({ yeastId: y.id })}
                className={`h-full w-full rounded-lg border p-2 text-left text-sm transition ${on ? 'border-honey-500 bg-honey-50 ring-1 ring-honey-400 dark:bg-honey-900/20' : 'border-stone-200 hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800/60'}`}>
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold leading-tight">{y.name}</span>
                  {on && <span className="text-xs font-bold text-honey-700 dark:text-honey-300">✓</span>}
                </span>
                <span className="mt-1 flex flex-wrap gap-1 text-[11px]">
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 dark:bg-stone-800">{y.tolerance} % ABV</span>
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 dark:bg-stone-800">{y.tempC[0]}–{y.tempC[1]} °C</span>
                  <span className={`rounded px-1.5 py-0.5 ${N_TONE[y.nDemand]}`}>{N_LABEL[y.nDemand]}</span>
                </span>
                <span className="mt-1 block text-xs text-stone-500 dark:text-stone-400">{y.notes}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="text-sm text-stone-500">No strains match these filters.</p>}
      {!showAll && maker === 'all' && n === 'all' && list.length > shown.length && (
        <button type="button" className="btn-ghost mt-2 text-xs" onClick={() => setShowAll(true)}>Show all {list.length} strains</button>
      )}
      {abvDry != null && abvDry > yeast.tolerance + 0.5 && (
        <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          This must could reach {abvDry.toFixed(1)} % if fermented dry, but {yeast.name} usually stops near {yeast.tolerance} %, so it will finish sweeter.
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
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
      </div>
      <p className="mt-2 text-[11px] text-stone-500">Strain data from the makers’ sheets. Check your packet: makers revise them.</p>
    </Card>
  );
}
