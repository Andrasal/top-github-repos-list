import type { Analysis } from '../lib/recipe';
import { Card, Stat, Tip } from './ui';
import type { UnitHelpers } from './units';

const STRENGTH: Record<string, string> = {
  'sub-hydromel': 'Below hydromel', hydromel: 'Hydromel (session)', standard: 'Standard', sack: 'Sack (strong)', 'over-sack': 'Beyond sack',
};

export function ResultsPanel({ a, uh, onProof }: { a: Analysis; uh: UnitHelpers; onProof: () => void }) {
  const o = a.occupancy;
  return (
    <Card title="Gravity, Alcohol & Volume" icon="📈">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Original gravity" value={a.og.toFixed(3)} sub={`${a.yan.brix.toFixed(1)} °Bx${a.hasSecondaryFruit ? ` · effective ${a.effectiveOg.toFixed(3)}` : ''}`} />
        <Stat label="Predicted FG" value={a.fg.fg.toFixed(3)} sub={a.fg.limitedBy === 'yeast' ? 'Limited by yeast tolerance' : a.fg.limitedBy === 'target' ? 'Your target FG' : 'Ferments dry'} />
        <Stat
          label="ABV (Alt. eq.)"
          tone="accent"
          value={`${a.abv.toFixed(2)} %`}
          sub={`ABW ${a.abw.toFixed(2)} % · ${STRENGTH[a.strength]}`}
          action={<button onClick={onProof} className="rounded bg-honey-500 px-1.5 py-0.5 text-[10px] font-bold normal-case text-stone-950">Show proof</button>}
        />
        <Stat label="Sweetness" value={<span className="capitalize">{a.sweetness}</span>} sub={`~${a.residualSugarGPerL.toFixed(0)} g/L residual sugar`} />
        <Stat label="Water to add" value={uh.fmtVol(a.primary.waterL)} sub={a.primary.overVolume ? 'Over volume!' : `Must mass ${uh.fmtMass(a.primary.massKg)}`} />
        <Stat label="Fermenter ≥" value={uh.fmtVol(o.recommendedFermenterL, 1)} sub={`${(o.headspaceFraction * 100).toFixed(0)} % headspace`} />
      </div>

      <div className="mt-4">
        <h3 className="label mb-1 flex items-center gap-1">
          Volume & displacement
          <Tip>Fruit juice replaces water you'd otherwise add. Day-0 counts intact fruit as solid volume; after breakdown only insoluble pulp remains (SPEC §5.3).</Tip>
        </h3>
        <dl className="tabular grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-stone-500">Must liquid volume</dt><dd className="text-right">{uh.fmtVol(a.primary.volumeL)}</dd>
          {a.hasSecondaryFruit && (<><dt className="text-stone-500">+ secondary juice → total</dt><dd className="text-right">{uh.fmtVol(a.whole.volumeL)}</dd></>)}
          <dt className="text-stone-500">Day-0 fermenter occupancy</dt><dd className="text-right">{uh.fmtVol(o.day0L)}</dd>
          <dt className="text-stone-500">After fruit breakdown</dt><dd className="text-right">{uh.fmtVol(o.brokenDownL)}</dd>
          <dt className="text-stone-500">Lost to pulp / lees</dt><dd className="text-right">{uh.fmtVol(o.fruitRetainedL)} / {uh.fmtVol(o.leesLossL)}</dd>
          <dt className="font-medium">Expected recovered</dt><dd className="text-right font-medium">{uh.fmtVol(o.recoveredL)}</dd>
          <dt className="text-stone-500">⅓ / ½ sugar break</dt><dd className="text-right">{a.breaks.oneThird.toFixed(3)} / {a.breaks.half.toFixed(3)}</dd>
        </dl>
      </div>

      {a.contributions.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <h3 className="label mb-1 flex items-center gap-1">
            Gravity contribution
            <Tip>ΔOG = OG with everything − OG without this ingredient, at the same volume (SPEC §5.4). PKL = points·L/kg; PPG = points·gal/lb.</Tip>
          </h3>
          <table className="tabular w-full text-sm">
            <thead className="text-left text-xs text-stone-500">
              <tr><th className="py-1">Ingredient</th><th className="text-right">Sugar</th><th className="text-right">+pts</th><th className="text-right">PKL</th><th className="text-right">PPG</th></tr>
            </thead>
            <tbody>
              {a.contributions.map((c) => (
                <tr key={c.key} className="border-t border-stone-200 dark:border-stone-800">
                  <td className="py-1">{c.label}</td>
                  <td className="text-right">{uh.fmtMass(c.sugarKg)}</td>
                  <td className="text-right">{c.deltaPoints.toFixed(1)}</td>
                  <td className="text-right">{c.pkl.toFixed(0)}</td>
                  <td className="text-right">{c.ppg.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
