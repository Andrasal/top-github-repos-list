import type { Analysis } from '../lib/recipe';
import { PROTOCOL_LABELS } from '../lib/nutrients';
import { Card, Cite, Stat, Tip } from './ui';

const g = (v: number) => (v > 0 ? `${v.toFixed(2)} g` : '—');

export function NutrientPanel({ a }: { a: Analysis }) {
  const s = a.schedule;
  const hasO = s.totals.fermaidO > 0, hasK = s.totals.fermaidK > 0, hasD = s.totals.dap > 0;
  return (
    <Card title="Yeast Nutrition (SNA)" icon="🧬" id="nutrients">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat
          label="YAN target"
          value={`${a.yan.netPpm.toFixed(0)} ppm`}
          sub={`${a.yan.brix.toFixed(1)} °Bx × 10 × ${a.yan.factor} (${a.demand})${a.yan.creditPpm > 0 ? ` − ${a.yan.creditPpm.toFixed(0)} fruit` : ''}`}
        />
        <Stat label="Yeast to pitch" value={`${a.rehydration.yeastG.toFixed(1)} g`} sub={a.og > 1.12 ? 'High gravity: 1 g/L' : '2 g per US gal'} />
        <Stat label="Go-Ferm" value={`${a.rehydration.goFermG.toFixed(1)} g`} sub={`in ${a.rehydration.waterMl.toFixed(0)} mL water at ${a.rehydration.waterTempC} °C`} />
      </div>
      <h3 className="label mb-1 mt-4 flex items-center gap-1">
        {PROTOCOL_LABELS[s.protocol]}
        <Tip>Four equal YAN additions. The 4th is triggered by the ⅓ sugar break or day 7, whichever comes first. Inorganic N (DAP) is never added at or after the ⅓ break (SPEC §7.2).</Tip>
      </h3>
      <div className="overflow-x-auto">
        <table className="tabular w-full text-sm">
          <thead className="text-left text-xs text-stone-500">
            <tr>
              <th className="py-1">#</th><th>When</th>
              {hasO && <th className="text-right">Fermaid O</th>}
              {hasK && <th className="text-right">Fermaid K</th>}
              {hasD && <th className="text-right">DAP</th>}
              <th className="text-right">YAN</th>
            </tr>
          </thead>
          <tbody>
            {s.doses.map((d) => (
              <tr key={d.n} className="border-t border-stone-200 dark:border-stone-800">
                <td className="py-1.5">{d.n}</td>
                <td className="pr-2">{d.when}{d.sgTrigger && <span className="block text-xs text-honey-700 dark:text-honey-300">at SG ≤ {d.sgTrigger.toFixed(3)}</span>}</td>
                {hasO && <td className="text-right">{g(d.fermaidO)}</td>}
                {hasK && <td className="text-right">{g(d.fermaidK)}</td>}
                {hasD && <td className="text-right">{g(d.dap)}</td>}
                <td className="text-right text-stone-500">{d.ppm.toFixed(0)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-stone-300 font-semibold dark:border-stone-700">
              <td className="py-1.5" colSpan={2}>Total</td>
              {hasO && <td className="text-right">{g(s.totals.fermaidO)}</td>}
              {hasK && <td className="text-right">{g(s.totals.fermaidK)}</td>}
              {hasD && <td className="text-right">{g(s.totals.dap)}</td>}
              <td className="text-right">{s.totals.ppm.toFixed(0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Fermaid O counted at 160 mg N/L per g/L (40 label × 4 organic factor); Fermaid K 100; DAP 210. Degas before each addition. <Cite ids={['tosna', 'scott-handbook', 'meadmaderight']} />
      </p>
    </Card>
  );
}
