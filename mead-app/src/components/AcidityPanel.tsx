import { useState } from 'react';
import type { Analysis, Recipe } from '../lib/recipe';
import { AcidId, BASES, BaseId } from '../lib/acidbase';
import { doseForTargetPh } from '../lib/phmodel';
import { fruitById } from '../lib/db';
import { doseBand } from '../lib/flavor';
import { Card, Cite, NumberField, RemoveButton, Select, Stat, Tip } from './ui';
import { uid } from './units';

const WATERS = [
  { label: 'RO / distilled', alk: 0 },
  { label: 'Soft', alk: 25 },
  { label: 'Spring', alk: 50 },
  { label: 'Average tap', alk: 100 },
  { label: 'Hard', alk: 250 },
];

const ADJ_LABEL: Record<AcidId | BaseId, string> = {
  tartaric: 'Tartaric acid', malic: 'Malic acid', citric: 'Citric acid', gluconic: 'Gluconic acid', succinic: 'Succinic acid', acetic: 'Acetic acid', lactic: 'Lactic acid',
  kBicarb: BASES.kBicarb.label, kCarb: BASES.kCarb.label, caCarb: BASES.caCarb.label,
};
const ADJ_OPTIONS: (AcidId | BaseId)[] = ['tartaric', 'malic', 'citric', 'lactic', 'kBicarb', 'kCarb', 'caCarb'];

const phColour = (ph: number) => (ph < 3.0 ? 'text-orange-700 dark:text-orange-300' : ph > 3.8 ? 'text-sky-700 dark:text-sky-300' : '');

export function AcidityPanel({ r, set, a }: { r: Recipe; set: (p: Partial<Recipe>) => void; a: Analysis }) {
  const ph = a.ph;
  const adj = r.adjustments ?? [];
  const [target, setTarget] = useState(3.5);
  const [targetStage, setTargetStage] = useState<'must' | 'finished'>('finished');
  const [answer, setAnswer] = useState<string | null>(null);

  const solve = () => {
    const current = targetStage === 'must' ? ph.mustPh : ph.finishedPh;
    const id: AcidId | BaseId = target < current ? 'tartaric' : 'kBicarb';
    const g = doseForTargetPh(a.phInput, id, target, targetStage);
    setAnswer(g == null ? 'Out of a sensible range. Reconsider the recipe instead.' : g === 0 ? 'Already there.' : `≈ ${g.toFixed(1)} g ${ADJ_LABEL[id]} (${(g / (targetStage === 'must' ? a.primary.volumeL : a.whole.volumeL)).toFixed(2)} g/L). Bench-trial a sample first.`);
  };

  return (
    <Card title="Acidity & pH" icon="⚗️" id="ph">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Must pH" value={<span className={phColour(ph.mustPh)}>{ph.mustPh.toFixed(2)}</span>} sub={`±${ph.uncertainty} · before fermentation`} />
        <Stat label="Finished pH" tone="accent" value={<span className={phColour(ph.finishedPh)}>{ph.finishedPh.toFixed(2)}</span>} sub={`after ${ph.succinicGPerL.toFixed(1)} g/L yeast acids`} />
        <Stat label="TA must" value={`${ph.mustTa.toFixed(1)} g/L`} sub="as tartaric" />
        <Stat label="TA finished" value={`${ph.finishedTa.toFixed(1)} g/L`} sub="as tartaric" />
      </div>
      <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
        Typical meads finish around pH 3.3–3.6. Yeast get stressed below about 3.0, and above 3.8 SO₂ protection gets expensive. This is a prediction: measure with a calibrated meter.
      </p>

      <div className="mt-3">
        <span className="label flex items-center gap-1">Water <Tip>Alkalinity (bicarbonate) neutralises acid. In the AHA study the same mead finished at pH 3.4 with distilled water and 3.8 with hard water. Your water report lists it as "alkalinity, mg/L as CaCO₃".</Tip></span>
        <div className="mt-1 flex flex-wrap items-end gap-1">
          {WATERS.map((w) => (
            <button key={w.label} onClick={() => set({ alkalinityCaCO3: w.alk })} className={`btn-ghost px-2 py-0.5 text-xs ${r.alkalinityCaCO3 === w.alk ? 'bg-honey-200 dark:bg-honey-800/50' : ''}`}>{w.label}</button>
          ))}
          <NumberField className="w-36" value={r.alkalinityCaCO3 ?? 50} onChange={(v) => set({ alkalinityCaCO3: v })} unit="mg/L CaCO₃" step={10} decimals={0} />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <h3 className="label mb-1 flex items-center gap-1">What moves the pH <Tip>pH change caused by each ingredient: the recipe with it, minus the recipe without it, everything else held fixed. pH doesn't blend linearly: buffered fruit juice keeps close to its own pH even when diluted, while honey has very little buffering. So a fruit can lower the must pH but slightly raise the finished pH: its buffer resists the acids yeast produce.</Tip></h3>
        <table className="tabular w-full text-sm">
          <thead className="text-left text-xs text-stone-500"><tr><th className="py-1">Ingredient</th><th className="text-right">Must ΔpH</th><th className="text-right">Finished ΔpH</th></tr></thead>
          <tbody>
            {ph.contributions.map((c) => (
              <tr key={c.key} className="border-t border-stone-200 dark:border-stone-800">
                <td className="py-1 pr-2">{c.label}</td>
                <td className="text-right">{c.deltaMust === 0 ? '—' : `${c.deltaMust > 0 ? '+' : ''}${c.deltaMust.toFixed(2)}`}</td>
                <td className="text-right">{`${c.deltaFinished > 0 ? '+' : ''}${c.deltaFinished.toFixed(2)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {a.fruitPhCurves.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <h3 className="label mb-1 flex items-center gap-1">Fruit dose → finished pH <Tip>Finished pH of this recipe if the fruit sat at each point of its dose scale. The highlighted cell is the dose band you're in now.</Tip></h3>
          <table className="tabular w-full text-sm">
            <thead className="text-left text-xs text-stone-500"><tr><th className="py-1">Fruit</th><th className="text-right">subtle</th><th className="text-right">typical</th><th className="text-right">bold</th><th className="text-right">max</th></tr></thead>
            <tbody>
              {a.fruitPhCurves.map((c) => {
                // The analysis can lag the live recipe by a render (useDeferredValue): read from its own recipe
                const f = a.recipe.fruits.find((x) => x.uid === c.uid);
                if (!f) return null;
                const fr = fruitById(f.fruitId);
                const band = doseBand(fr, f.massKg / a.whole.volumeL);
                return (
                  <tr key={c.uid} className="border-t border-stone-200 dark:border-stone-800">
                    <td className="py-1 pr-2">{fr.name}<span className="block text-[10px] text-stone-500">juice pH {fr.ph} ({fr.phRange[0]}–{fr.phRange[1]})</span></td>
                    {c.points.map((p) => (
                      <td key={p.band} className={`text-right ${band === p.band || (band === 'assertive' && p.band === 'bold') ? 'font-bold text-honey-700 dark:text-honey-300' : ''}`}>
                        <span className={phColour(p.finishedPh)}>{p.finishedPh.toFixed(2)}</span>
                        <span className="block text-[10px] font-normal text-stone-500">{p.kgPerL} kg/L</span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="label">Acid & buffer additions</h3>
          <button className="btn-ghost text-xs" onClick={() => set({ adjustments: [...adj, { uid: uid(), id: 'tartaric', grams: 0.5 * a.whole.volumeL, stage: 'finished' }] })}>+ Addition</button>
        </div>
        {adj.map((x, i) => {
          const c = ph.contributions.find((k) => k.key === `adj-${adj.filter((y) => y.grams > 0).indexOf(x)}`);
          const upd = (p: Partial<typeof x>) => set({ adjustments: adj.map((y, j) => (j === i ? { ...y, ...p } : y)) });
          return (
            <div key={x.uid} className="mb-2 flex flex-wrap items-end gap-2">
              <Select className="min-w-[9rem] flex-1" value={x.id} onChange={(id) => upd({ id })} options={ADJ_OPTIONS.map((o) => ({ value: o, label: ADJ_LABEL[o] }))} />
              <NumberField className="w-24" value={x.grams} onChange={(grams) => upd({ grams })} unit="g" step={0.5} decimals={1} />
              <Select className="w-28" value={x.stage} onChange={(stage) => upd({ stage })} options={[{ value: 'must', label: 'In must' }, { value: 'finished', label: 'Finished' }]} />
              <span className="tabular w-14 text-right text-xs text-stone-500">{c ? `${c.deltaFinished > 0 ? '+' : ''}${c.deltaFinished.toFixed(2)}` : ''}</span>
              <RemoveButton label="Remove addition" onClick={() => set({ adjustments: adj.filter((_, j) => j !== i) })} />
            </div>
          );
        })}
        {adj.length === 0 && <p className="text-xs text-stone-500">None. Add acid or a buffer to see its effect on pH and TA.</p>}
      </div>

      <details className="mt-3 rounded-lg border border-stone-200 p-3 dark:border-stone-800">
        <summary className="cursor-pointer text-sm font-semibold">🎯 How much to reach a pH?</summary>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <NumberField className="w-24" label="Target pH" value={target} onChange={setTarget} step={0.05} min={2.8} max={4.2} decimals={2} />
          <Select className="w-32" label="Adjust" value={targetStage} onChange={setTargetStage} options={[{ value: 'finished', label: 'Finished mead' }, { value: 'must', label: 'Must' }]} />
          <button className="btn-primary" onClick={solve}>Calculate</button>
        </div>
        {answer && <p className="mt-2 text-sm">{answer}</p>}
      </details>

      <p className="mt-3 text-[11px] leading-snug text-stone-500">
        Method: acid–base charge balance with each acid's dissociation constants (Davies activity correction). Fruit is rebuilt from its measured pH and acidity, honey from its pH and acidity (USDA 1962 averages), and water from its alkalinity. Yeast acids are calibrated on two published mead studies, matching their measured pH to within 0.02 on average. Honey pH varies from 3.4 to 6.1, so allow ±0.2. <Cite ids={['fda-ph', 'white-1962', 'pereira-2015', 'aha-water-2015', 'brsquared-fruit', 'crc-pka']} />
      </p>
    </Card>
  );
}
