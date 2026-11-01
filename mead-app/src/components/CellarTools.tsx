import { useState } from 'react';
import { benchTrial, hydrometerCorrect, refractometerFg, refractometerOg, sulfitePpmFromGrams } from '../lib/cellar';
import { sgToPlato } from '../lib/gravity';
import { SULFITE_FORMS, type SulfiteForm } from '../lib/sulfite';
import { Card, Cite, NumberField, Select } from './ui';
import type { UnitHelpers } from './units';

const Out = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-lg bg-honey-50 p-2 dark:bg-honey-900/20">
    <div className="label">{label}</div>
    <div className="tabular text-lg font-semibold">{value}</div>
    {sub && <div className="text-[11px] text-stone-500">{sub}</div>}
  </div>
);

/** Hydrometer temperature correction and refractometer conversion (SPEC §26). */
export function ReadingTools({ onUse }: { onUse?: (sg: number) => void }) {
  const [tab, setTab] = useState<'hydro' | 'refr'>('hydro');
  const [reading, setReading] = useState(1.05);
  const [tempC, setTempC] = useState(25);
  const [calC, setCalC] = useState(20);
  const [ob, setOb] = useState(24);
  const [fb, setFb] = useState(9);
  const [wcf, setWcf] = useState(1.0);
  const [started, setStarted] = useState(false);
  const corrected = hydrometerCorrect(reading, tempC, calC);
  const refrSg = started ? refractometerFg(ob, fb, wcf) : refractometerOg(ob, wcf);
  const result = tab === 'hydro' ? corrected : refrSg;
  return (
    <Card title="Correct a reading" icon="🌡️">
      <div className="mb-3 flex rounded-md bg-stone-200 p-0.5 text-xs dark:bg-stone-800" role="tablist">
        {(['hydro', 'refr'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex-1 rounded px-2 py-1 font-medium ${tab === t ? 'bg-white shadow dark:bg-stone-600' : 'text-stone-500'}`}>
            {t === 'hydro' ? 'Hydrometer temperature' : 'Refractometer'}
          </button>
        ))}
      </div>
      {tab === 'hydro' ? (
        <div className="grid grid-cols-3 gap-2">
          <NumberField label="Reading" value={reading} onChange={setReading} step={0.001} min={0.98} max={1.2} decimals={3} />
          <NumberField label="Sample" value={tempC} onChange={setTempC} unit="°C" step={1} min={0} max={40} decimals={1} />
          <NumberField label="Calibrated" value={calC} onChange={setCalC} unit="°C" step={0.5} min={10} max={25} decimals={2} hint="Printed on the hydrometer: usually 20 °C, or 60 °F (15.56 °C) on US instruments." />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <NumberField label={started ? 'Original °Bx' : 'Reading °Bx'} value={ob} onChange={setOb} step={0.1} min={0} max={40} decimals={1} />
          {started && <NumberField label="Now °Bx" value={fb} onChange={setFb} step={0.1} min={0} max={40} decimals={1} />}
          <NumberField label="Correction" value={wcf} onChange={setWcf} step={0.01} min={0.9} max={1.1} decimals={2} hint="Wort correction factor. 1.00 for most honey musts; check yours against a hydrometer once." />
          <label className="col-span-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={started} onChange={(e) => setStarted(e.target.checked)} />
            Fermentation has started (alcohol skews refractometers)
          </label>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Out label={tab === 'hydro' ? 'Corrected SG' : started ? 'Estimated SG' : 'SG'} value={result.toFixed(3)} sub={`${sgToPlato(result).toFixed(1)} °Bx equivalent`} />
        <Out label="Change" value={`${((result - (tab === 'hydro' ? reading : 1)) * 1000).toFixed(1)} pts`} sub={tab === 'hydro' ? 'added to your reading' : 'gravity points'} />
      </div>
      {tab === 'refr' && started && <p className="mt-2 text-[11px] text-stone-500">Approximate (±0.003): the formula was fitted on beer. Confirm the finish with a hydrometer.</p>}
      {onUse && <button type="button" className="btn-ghost mt-2 border border-stone-300 text-xs dark:border-stone-700" onClick={() => onUse(Number(result.toFixed(3)))}>Log {result.toFixed(3)} as a reading</button>}
      <div className="mt-2"><Cite ids={tab === 'hydro' ? ['tanaka-2001'] : ['terrill-2011', 'lincoln']} /></div>
    </Card>
  );
}

/** Scale a tasting-glass trial up to the batch. */
export function BenchTrialCard({ volumeL, uh }: { volumeL: number; uh: UnitHelpers }) {
  const [ml, setMl] = useState(100);
  const [mg, setMg] = useState(50);
  const [what, setWhat] = useState('Tartaric acid');
  const t = benchTrial(ml, mg, volumeL);
  return (
    <Card title="Bench trial: glass to batch" icon="🥂">
      <p className="mb-2 text-sm text-stone-600 dark:text-stone-300">Add a little to a measured glass, taste, and adjust. When it tastes right, this scales it to {uh.fmtVol(volumeL)}.</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-3 flex flex-col gap-1"><span className="label">What you added</span><input value={what} onChange={(e) => setWhat(e.target.value)} /></label>
        <NumberField label="Glass" value={ml} onChange={setMl} unit="mL" step={10} min={1} decimals={0} />
        <NumberField label="Added" value={mg} onChange={setMg} unit="mg" step={5} decimals={0} />
        <Out label="Rate" value={`${t.gPerL.toFixed(2)} g/L`} />
      </div>
      <div className="mt-2"><Out label={`${what || 'Additive'} for the batch`} value={`${t.grams.toFixed(t.grams < 10 ? 2 : 1)} g`} sub="Dissolve in a little mead first, stir in, taste again after a day." /></div>
    </Card>
  );
}

/** What a weighed amount of sulfite actually delivers (the reverse of the dose planner). */
export function SulfiteFromWeight({ volumeL, uh }: { volumeL: number; uh: UnitHelpers }) {
  const [grams, setGrams] = useState(0.5);
  const [form, setForm] = useState<SulfiteForm>('kmeta');
  const ppm = sulfitePpmFromGrams(grams, volumeL, form);
  return (
    <Card title="Already weighed some?" icon="⚖️">
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Weight" value={grams} onChange={setGrams} unit="g" step={0.05} decimals={2} />
        <Select<SulfiteForm> label="Product" value={form} onChange={setForm} options={(Object.keys(SULFITE_FORMS) as SulfiteForm[]).filter((f) => f !== 'campden').map((f) => ({ value: f, label: SULFITE_FORMS[f].label }))} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Out label="SO₂ added" value={`${ppm.toFixed(1)} mg/L`} sub={`in ${uh.fmtVol(volumeL)}`} />
        <Out label="Campden tablets" value={(grams / 0.44).toFixed(1)} sub="equivalent (0.44 g each)" />
      </div>
    </Card>
  );
}
