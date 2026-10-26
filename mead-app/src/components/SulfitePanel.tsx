import type { Analysis, Recipe, SulfiteSettings } from '../lib/recipe';
import { DEFAULT_SULFITE } from '../lib/recipe';
import { freeForMolecular, SULFITE_FORMS, SulfiteForm } from '../lib/sulfite';
import { SO2_LIMIT_EU_MEAD, SO2_LIMIT_US_TOTAL } from '../lib/constants';
import { Card, Cite, NumberField, Select, Stat, Tip } from './ui';
import type { UnitHelpers } from './units';

const SEV = { error: 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40', warning: 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40', info: 'border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900' };

export function SulfitePanel({ r, set, a, uh }: { r: Recipe; set: (p: Partial<Recipe>) => void; a: Analysis; uh: UnitHelpers }) {
  const so: SulfiteSettings = { ...DEFAULT_SULFITE, ...r.sulfite };
  const upd = (p: Partial<SulfiteSettings>) => set({ sulfite: { ...so, ...p } });
  const p = a.sulfite;
  const totalPct = Math.min(100, (p.after.totalPpm / SO2_LIMIT_US_TOTAL) * 100);
  return (
    <Card title="Sulfite & Stabilisation" icon="🧂" id="sulfite">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          {so.usePredictedPh ? (
            <Stat label="pH (predicted)" value={a.ph.finishedPh.toFixed(2)} sub="from the Acidity & pH model" />
          ) : (
            <NumberField label="pH (measured)" value={so.pH} onChange={(v) => upd({ pH: v })} step={0.01} min={2.8} max={4.6} decimals={2}
              hint="From a calibrated meter. Each 0.1 pH changes the free SO₂ you need by roughly 25 %." />
          )}
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={!so.usePredictedPh} onChange={(e) => upd({ usePredictedPh: !e.target.checked, pH: Number(a.ph.finishedPh.toFixed(2)) })} />
            I measured it
          </label>
        </div>
        <NumberField label="Current free SO₂" value={so.currentFreePpm} onChange={(v) => upd({ currentFreePpm: v })} unit="mg/L" step={1} decimals={0}
          hint="From titration (aeration-oxidation or Ripper) or a test kit. Use 0 for a fresh ferment." />
        <NumberField label="Current total SO₂" value={so.currentTotalPpm} onChange={(v) => upd({ currentTotalPpm: v })} unit="mg/L" step={1} decimals={0} />
        <div className="flex flex-col gap-1">
          <NumberField label="Target molecular" value={so.targetMolecularPpm} onChange={(v) => upd({ targetMolecularPpm: v })} unit="mg/L" step={0.05} min={0.2} max={2} decimals={2}
            hint="0.8 mg/L for light, fruity or sweet meads. 0.5 for tannic or red meads. Above ~1.5 it can be smelt." />
          <div className="flex gap-1">
            {[0.5, 0.8].map((v) => (
              <button key={v} className={`btn-ghost px-2 py-0.5 text-xs ${so.targetMolecularPpm === v ? 'bg-honey-100 dark:bg-honey-900/40' : ''}`} onClick={() => upd({ targetMolecularPpm: v })}>{v}</button>
            ))}
          </div>
        </div>
        <NumberField label="Binding of addition" value={so.bindingPct} onChange={(v) => upd({ bindingPct: v })} unit="%" step={5} min={0} max={80} decimals={0}
          hint="Part of each addition binds right away to acetaldehyde, sugars and keto-acids. The first addition after fermentation often loses 25–50 %. Later additions lose less." />
        <Select<SulfiteForm> label="Product" value={so.form} onChange={(form) => upd({ form })}
          options={(Object.keys(SULFITE_FORMS) as SulfiteForm[]).map((k) => ({ value: k, label: SULFITE_FORMS[k].label }))} />
        <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-3">
          <input type="checkbox" checked={so.volumeOverrideL == null} onChange={(e) => upd({ volumeOverrideL: e.target.checked ? null : Number(p.input.volumeL.toFixed(2)) })} />
          Treat expected recovered volume ({uh.fmtVol(so.volumeOverrideL == null ? p.input.volumeL : a.occupancy.recoveredL)})
        </label>
        {so.volumeOverrideL != null && (
          <NumberField label="Volume to treat" value={so.volumeOverrideL} onChange={(v) => upd({ volumeOverrideL: v })} {...uh.vol} decimals={2} />
        )}
        <Select<'auto' | 'on' | 'off'> label="Potassium sorbate" value={so.sorbate == null ? 'auto' : so.sorbate ? 'on' : 'off'}
          onChange={(v) => upd({ sorbate: v === 'auto' ? null : v === 'on' })}
          options={[{ value: 'auto', label: `Auto (${r.targetFg != null ? 'on: back-sweetening' : 'off'})` }, { value: 'on', label: 'Add' }, { value: 'off', label: 'None' }]} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Free SO₂ needed" value={`${p.requiredFreePpm.toFixed(0)} mg/L`} sub={`${(p.molecularFraction * 100).toFixed(2)} % molecular at pH ${p.input.pH.toFixed(2)} · pKa ${p.pKa.toFixed(2)} (${p.input.abv.toFixed(1)} % ABV)`} />
        <Stat label="Add" tone="accent" value={`${p.productGrams.toFixed(2)} g`} sub={`${p.additionPpm.toFixed(0)} mg/L SO₂ · ${SULFITE_FORMS[so.form].label.split(' (')[0]}`} />
        <Stat label="Alternatives" value={`${p.campdenTablets.toFixed(1)} tabs`} sub={`Campden · or ${p.stockSolutionMl.toFixed(1)} mL of 10 % K-meta stock`} />
        <Stat label="Free after" value={`${p.after.freePpm.toFixed(0)} mg/L`} sub={`was ${so.currentFreePpm.toFixed(0)}`} />
        <Stat label="Molecular after" value={`${p.after.molecularPpm.toFixed(2)} mg/L`} sub={`was ${p.currentMolecularPpm.toFixed(2)}`} />
        <Stat label="Total after" value={`${p.after.totalPpm.toFixed(0)} mg/L`} sub={`${p.after.boundPpm.toFixed(0)} bound · limits US ${SO2_LIMIT_US_TOTAL} / EU ${SO2_LIMIT_EU_MEAD}`} />
      </div>
      <div className="mt-2" aria-label="Total SO2 against the US limit">
        <div className="relative h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
          <div className={`h-full ${p.after.totalPpm > SO2_LIMIT_US_TOTAL ? 'bg-red-500' : p.after.totalPpm > SO2_LIMIT_EU_MEAD ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${totalPct}%` }} />
          <div className="absolute top-0 h-full w-0.5 bg-amber-700" style={{ left: `${(SO2_LIMIT_EU_MEAD / SO2_LIMIT_US_TOTAL) * 100}%` }} title="EU mead limit" />
        </div>
        <div className="mt-0.5 flex justify-between text-[10px] text-stone-500"><span>0</span><span>EU 200</span><span>US 350 mg/L</span></div>
      </div>
      {p.sorbate && (
        <p className="mt-3 rounded-lg bg-honey-50 p-2 text-sm dark:bg-honey-900/20">
          <b>Potassium sorbate:</b> {p.sorbate.grams.toFixed(2)} g (0.2 g/L ≈ {p.sorbate.sorbicPpm.toFixed(0)} mg/L sorbic acid). Add it together with the SO₂ before back-sweetening.
        </p>
      )}

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium">Free SO₂ needed by pH (for {so.targetMolecularPpm} mg/L molecular at {p.input.abv.toFixed(1)} % ABV)</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="tabular w-full text-xs">
            <tbody>
              <tr className="text-stone-500"><td className="pr-2">pH</td>{[3.0, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.0].map((x) => <td key={x} className="px-1 text-right">{x.toFixed(1)}</td>)}</tr>
              <tr><td className="pr-2 text-stone-500">mg/L</td>{[3.0, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.0].map((x) => <td key={x} className="px-1 text-right">{freeForMolecular(so.targetMolecularPpm, x, p.pKa).toFixed(0)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </details>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium">Notes</summary>
      <ul className="mt-2 flex flex-col gap-2">
        {p.warnings.filter((w) => w.severity === 'info').map((w) => (
          <li key={w.text} className={`rounded-lg border p-2 text-xs ${SEV[w.severity]}`}>
            {w.text} <Cite ids={w.source} />
          </li>
        ))}
      </ul>
      </details>
      <p className="mt-2 flex items-center gap-1 text-xs text-stone-500">
        molecular = free ÷ (1 + 10^(pH − pKa)), with pKa from the OIV table for your ABV · K-meta is 57.6 % SO₂
        <Tip>2 × 64.07 g/mol SO₂ per 222.32 g/mol K₂S₂O₅. Dissolve the dose in a little water or mead, stir it in gently, and re-measure free SO₂ after 24–48 h.</Tip>
      </p>
    </Card>
  );
}
