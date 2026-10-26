import { useState } from 'react';
import { abvProof, AbvDomainError } from '../lib/abv';
import { Cite, NumberField } from './ui';

/** "Show proof" content — SPEC §4 visible source-citation feature. */
export function AbvProofView({ og, fg }: { og: number; fg: number }) {
  let proof: ReturnType<typeof abvProof> | null = null;
  let err = '';
  try {
    proof = abvProof(og, fg);
  } catch (e) {
    err = e instanceof AbvDomainError ? e.message : String(e);
  }
  return (
    <div className="space-y-4 text-sm">
      <div className="overflow-x-auto rounded-lg bg-stone-900 p-3 font-mono text-[13px] text-honey-200">
        ABV(%) = [ 76.08 × (OG − FG) / (1.775 − OG) ] × [ FG / 0.794 ]
      </div>
      {err && <p className="rounded bg-red-100 p-2 text-red-800 dark:bg-red-950 dark:text-red-200">{err}</p>}
      {proof && (
        <table className="w-full text-left">
          <tbody>
            {proof.steps.map((s) => (
              <tr key={s.label} className="border-b border-stone-200 dark:border-stone-800">
                <td className="py-1.5 pr-2">{s.label}</td>
                <td className="tabular py-1.5 pr-2 font-mono text-xs text-stone-500">{s.expr}</td>
                <td className="tabular py-1.5 text-right font-semibold">{s.value.toFixed(4)}</td>
              </tr>
            ))}
            <tr>
              <td className="pt-2 font-semibold" colSpan={2}>Alcohol by volume</td>
              <td className="tabular pt-2 text-right text-lg font-bold text-honey-600">{proof.abv.toFixed(2)} %</td>
            </tr>
          </tbody>
        </table>
      )}
      <div className="space-y-2 text-stone-600 dark:text-stone-300">
        <p>
          <b>Term 1 — alcohol by weight.</b> Hall re-expressed Balling's fermentation stoichiometry (2.0665 g extract → 1 g ethanol + 0.9565 g CO₂ + 0.11 g yeast)
          in terms of specific gravity. The <code>(1.775 − OG)</code> pole makes the equation non-linear: each gravity point carries more extract at high gravity, which is
          exactly where meads live.
        </p>
        <p>
          <b>Term 2 — weight → volume.</b> <code>ABV = ABW × ρ<sub>mead</sub> / ρ<sub>ethanol</sub></code>, with ρ<sub>mead</sub> ≈ FG and ρ<sub>ethanol</sub> = 0.794 g/mL at 20 °C.
        </p>
        {proof && (
          <p className="rounded-lg border border-dashed border-stone-300 p-2 text-xs dark:border-stone-700">
            <b>Why not the linear rule?</b> <code>(OG − FG) × 131.25</code> would report {proof.linearComparison.toFixed(2)} % here — under-reporting by{' '}
            {(proof.abv - proof.linearComparison).toFixed(2)} points. It is a low-gravity beer approximation and is shown for comparison only; this app never uses it.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="label">Sources</span>
          <Cite ids={['hall-1995', 'brewersfriend-abv', 'balling']} />
        </div>
      </div>
    </div>
  );
}

export function AbvCalculator() {
  const [og, setOg] = useState(1.12);
  const [fg, setFg] = useState(1.01);
  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-600 dark:text-stone-300">Enter your measured hydrometer readings.</p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Measured OG" value={og} onChange={setOg} step={0.001} min={1} max={1.3} decimals={3} />
        <NumberField label="Measured FG" value={fg} onChange={setFg} step={0.001} min={0.98} max={1.3} decimals={3} />
      </div>
      <AbvProofView og={og} fg={fg} />
    </div>
  );
}
