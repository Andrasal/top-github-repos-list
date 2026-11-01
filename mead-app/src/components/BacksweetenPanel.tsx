import { useMemo, useState } from 'react';
import type { Analysis, Recipe } from '../lib/recipe';
import { abv as abvFn, fgForAbv } from '../lib/abv';
import { honeyOnly, planPrimary, solveBlend } from '../lib/backsweeten';
import { designForTarget } from '../lib/designer';
import { honeyById } from '../lib/db';
import { RHO_HONEY_DEFAULT } from '../lib/constants';
import { Card, Cite, NumberField } from './ui';
import type { UnitHelpers } from './units';

const FINISH = [
  { label: 'Off-dry', sg: 1.006 },
  { label: 'Semi-sweet', sg: 1.012 },
  { label: 'Sweet', sg: 1.02 },
  { label: 'Dessert', sg: 1.03 },
];

const Box = ({ title, tone = 'plain', children }: { title: string; tone?: 'plain' | 'good' | 'warn'; children: React.ReactNode }) => (
  <section className={`rounded-xl border p-3 ${tone === 'good' ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30' : tone === 'warn' ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30' : 'border-stone-200 dark:border-stone-700'}`}>
    <h3 className="mb-2 text-sm font-semibold">{title}</h3>
    {children}
  </section>
);
const Num = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div><div className="label">{label}</div><div className="tabular text-lg font-semibold">{value}</div>{sub && <div className="text-[11px] text-stone-500">{sub}</div>}</div>
);

/** SPEC §27 — honey alone, honey + water/spirit, or plan a higher OG next time. */
export function BacksweetenPanel({ a, r, replace, uh }: { a: Analysis; r: Recipe; replace: (r: Recipe) => void; uh: UnitHelpers }) {
  // The unsweetened mead: where the yeast stops on its own (not the target FG, which is the goal here)
  const natural = useMemo(() => {
    const tol = a.yeast.tolerance;
    const fg = abvFn(a.effectiveOg, r.dryFg) <= tol ? r.dryFg : fgForAbv(a.effectiveOg, tol);
    return { sg: fg, abv: abvFn(a.effectiveOg, fg) };
  }, [a, r.dryFg]);
  const readings = r.log.readings;
  const fromLog = readings.length >= 2 ? { sg: readings[readings.length - 1].sg, abv: abvFn(readings[0].sg, Math.min(readings[0].sg, readings[readings.length - 1].sg)) } : null;
  const defaultVol = a.sulfite.input.volumeL;

  const [volumeL, setVolumeL] = useState(defaultVol);
  const [sg, setSg] = useState(natural.sg);
  const [abv, setAbv] = useState(Number(natural.abv.toFixed(2)));
  const [targetSg, setTargetSg] = useState(r.targetFg ?? 1.012);
  const [targetAbv, setTargetAbv] = useState(Number(natural.abv.toFixed(1)));
  const [spirit, setSpirit] = useState(40);
  const honeyDensity = r.honeys[0] ? honeyById(r.honeys[0].honeyId).density : RHO_HONEY_DEFAULT;
  const honeyName = r.honeys[0] ? honeyById(r.honeys[0].honeyId).name.toLowerCase() : 'honey';

  const mead = { volumeL, sg, abv };
  const alone = honeyOnly(mead, targetSg, honeyDensity);
  const blend = solveBlend(mead, { sg: targetSg, abv: targetAbv }, spirit, honeyDensity);
  const plan = planPrimary(volumeL, r.dryFg, { sg: targetSg, abv: targetAbv }, honeyDensity);
  const tooLow = targetSg <= sg;

  return (
    <Card title="Backsweeten" icon="🥄">
      <p className="mb-3 text-sm text-stone-600 dark:text-stone-300">
        Honey adds sweetness <b>and volume</b>, so it also waters down the alcohol. This works out honey alone, or honey with water or spirit, to land on both the sweetness and the strength you want.
      </p>
      <div className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        Stabilise first (sulfite + sorbate, previous step) and wait 24–48 h, or the yeast will ferment the new honey.
      </div>

      <h3 className="label mb-1">Your mead now</h3>
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Volume" value={volumeL} onChange={setVolumeL} {...uh.vol} decimals={2} min={0.1} />
        <NumberField label="Gravity" value={sg} onChange={setSg} step={0.001} min={0.98} max={1.2} decimals={3} />
        <NumberField label="ABV" value={abv} onChange={setAbv} unit="%" step={0.1} max={25} decimals={2} />
      </div>
      <div className="mt-1 flex flex-wrap gap-2 text-xs">
        <button type="button" className="underline" onClick={() => { setVolumeL(defaultVol); setSg(natural.sg); setAbv(Number(natural.abv.toFixed(2))); }}>Use recipe prediction</button>
        {fromLog && <button type="button" className="underline" onClick={() => { setSg(fromLog.sg); setAbv(Number(fromLog.abv.toFixed(2))); }}>Use batch log ({fromLog.sg.toFixed(3)}, {fromLog.abv.toFixed(1)} %)</button>}
      </div>

      <h3 className="label mb-1 mt-3">Where you want to end up</h3>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {FINISH.map((f) => (
          <button key={f.label} type="button" onClick={() => setTargetSg(f.sg)} className={`rounded-full border px-2.5 py-1 text-xs ${Math.abs(targetSg - f.sg) < 1e-6 ? 'border-honey-500 bg-honey-100 font-semibold dark:bg-honey-900/40' : 'border-stone-300 dark:border-stone-700'}`}>{f.label} {f.sg.toFixed(3)}</button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Target gravity" value={targetSg} onChange={setTargetSg} step={0.001} min={0.99} max={1.1} decimals={3} />
        <NumberField label="Target ABV" value={targetAbv} onChange={setTargetAbv} unit="%" step={0.1} max={25} decimals={1} />
        <NumberField label="Spirit" value={spirit} onChange={setSpirit} unit="%" step={1} min={20} max={96} decimals={0} hint="Strength of the spirit you'd add to keep or raise the ABV (vodka or brandy 40 %, neutral spirit up to 96 %)." />
      </div>

      {tooLow ? (
        <p className="mt-3 text-sm text-stone-500">The target gravity is at or below where your mead is now, so there is nothing to sweeten.</p>
      ) : (
        <div className="mt-3 grid gap-3">
          <Box title={`1 · Honey only`}>
            <div className="grid grid-cols-3 gap-2">
              <Num label="Add" value={uh.fmtMass(alone.honeyKg, 3)} sub={`${honeyName}, ≈ ${(alone.honeyKg * 1000).toFixed(0)} g`} />
              <Num label="New volume" value={uh.fmtVol(alone.volumeL)} sub={`+${uh.fmtVol(alone.volumeL - volumeL)}`} />
              <Num label="ABV after" value={`${alone.abv.toFixed(2)} %`} sub={`${(alone.abv - abv).toFixed(2)} % from dilution`} />
            </div>
          </Box>
          <Box title={`2 · Hit ${targetSg.toFixed(3)} and ${targetAbv.toFixed(1)} % together`} tone={blend.ok ? 'good' : 'warn'}>
            {blend.ok ? (
              blend.partner === 'none' ? <p className="text-sm">Honey alone already lands on this ABV.</p> : (
                <div className="grid grid-cols-3 gap-2">
                  <Num label="Honey" value={uh.fmtMass(blend.honeyKg, 3)} sub={`≈ ${(blend.honeyKg * 1000).toFixed(0)} g`} />
                  <Num label={blend.partner === 'spirit' ? `${spirit} % spirit` : 'Water'} value={uh.fmtVol(blend.partnerL, 3)} sub={`≈ ${(blend.partnerL * 1000).toFixed(0)} mL`} />
                  <Num label="Final" value={uh.fmtVol(blend.volumeL)} sub={`${targetSg.toFixed(3)} · ${targetAbv.toFixed(1)} %`} />
                </div>
              )
            ) : <p className="text-sm">{blend.reason}</p>}
            {blend.partner === 'spirit' && blend.ok && <p className="mt-2 text-[11px] text-stone-500">Adding spirit makes it a fortified mead; check what your local rules allow if you sell it.</p>}
          </Box>
          <Box title="3 · Next time: start stronger instead">
            <p className="mb-2 text-xs text-stone-500">Ferment dry from a higher OG so the honey's dilution lands exactly on {targetAbv.toFixed(1)} %.</p>
            <div className="grid grid-cols-3 gap-2">
              <Num label="Primary OG" value={plan.requiredOg.toFixed(3)} sub={`now ${a.og.toFixed(3)}`} />
              <Num label="ABV before" value={`${plan.abvBefore.toFixed(2)} %`} sub={`dry at ${r.dryFg.toFixed(3)}`} />
              <Num label="Then add" value={uh.fmtMass(plan.honeyKg, 3)} sub="honey to sweeten" />
            </div>
            <button type="button" className="btn-ghost mt-2 border border-stone-300 text-xs dark:border-stone-700"
              onClick={() => { try { const d = designForTarget({ ...r, targetFg: null }, plan.abvBefore, r.dryFg); replace({ ...d.recipe, targetFg: null }); } catch { /* keep recipe */ } }}>
              Scale the recipe’s honey for OG {plan.requiredOg.toFixed(3)}
            </button>
          </Box>
        </div>
      )}
      <p className="mt-3 text-[11px] text-stone-500">Model: mass, sugar and alcohol are conserved; volumes add (spirit–mead contraction ignored, under 0.3 % of the spirit). Honey uses the same calibration as the must. Spirit density from real ethanol–water tables.</p>
      <div className="mt-1"><Cite ids={['nhb-honey', 'crc-ethanol', 'hall-1995']} /></div>
    </Card>
  );
}
