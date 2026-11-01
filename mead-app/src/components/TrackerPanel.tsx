import { useEffect, useState } from 'react';
import type { Analysis, Recipe } from '../lib/recipe';
import type { BatchLog } from '../lib/tracker';
import { EMPTY_LOG, TrackerStatus } from '../lib/tracker';
import { Card, NumberField, RemoveButton, Stat } from './ui';
import { uid } from './units';

const toLocal = (ms: number) => { const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fmtWhen = (ms: number | null) => (ms == null ? '—' : new Date(ms).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }));

const DOSE_STYLE = {
  done: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
  due: 'bg-honey-200 text-honey-950 dark:bg-honey-800/60 dark:text-honey-50',
  overdue: 'bg-orange-200 text-orange-950 dark:bg-orange-900/50 dark:text-orange-100',
  upcoming: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200',
  waiting: 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400',
} as const;

function Chart({ t, fg, og }: { t: TrackerStatus; fg: number; og: number }) {
  const W = 320, Hh = 150, pad = { l: 40, r: 10, t: 10, b: 22 };
  const days = Math.max(7, ...t.series.map((p) => p.day), t.days);
  const hi = Math.max(og, ...t.series.map((p) => p.sg)) + 0.004;
  const lo = Math.min(fg, ...t.series.map((p) => p.sg)) - 0.004;
  const x = (d: number) => pad.l + (d / days) * (W - pad.l - pad.r);
  const y = (sg: number) => pad.t + ((hi - sg) / (hi - lo)) * (Hh - pad.t - pad.b);
  const ticks = [hi - 0.004, (hi + lo) / 2, lo + 0.004];
  const line = (sg: number, label: string, cls: string) => (
    <g>
      <line x1={pad.l} x2={W - pad.r} y1={y(sg)} y2={y(sg)} className={cls} strokeDasharray="4 3" strokeWidth={1} />
      <text x={W - pad.r} y={y(sg) - 3} textAnchor="end" className="fill-stone-500 text-[9px]">{label} {sg.toFixed(3)}</text>
    </g>
  );
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${Hh}`} className="w-full min-w-[18rem]" role="img" aria-label="Gravity over time">
        {ticks.map((v) => <text key={v} x={pad.l - 4} y={y(v)} textAnchor="end" dominantBaseline="middle" className="tabular fill-stone-500 text-[9px]">{v.toFixed(3)}</text>)}
        {[0, Math.round(days / 2), Math.round(days)].map((d, i) => <text key={d} x={x(d)} y={Hh - 6} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="fill-stone-500 text-[9px]">day {d}</text>)}
        <line x1={pad.l} x2={pad.l} y1={pad.t} y2={Hh - pad.b} className="stroke-stone-300 dark:stroke-stone-700" />
        {line(t.breakSg, '⅓ break', 'stroke-honey-500')}
        {line(fg, 'expected FG', 'stroke-emerald-500')}
        {t.series.length > 1 && <polyline points={t.series.map((p) => `${x(p.day)},${y(p.sg)}`).join(' ')} className="fill-none stroke-honey-600 dark:stroke-honey-400" strokeWidth={2} strokeLinejoin="round" />}
        {t.series.map((p, i) => <circle key={i} cx={x(p.day)} cy={y(p.sg)} r={i === t.series.length - 1 ? 4 : 2.5} className="fill-honey-600 dark:fill-honey-400" />)}
        {t.started && t.days <= days && <line x1={x(t.days)} x2={x(t.days)} y1={pad.t} y2={Hh - pad.b} className="stroke-stone-400" strokeWidth={1} strokeDasharray="2 2" />}
      </svg>
    </div>
  );
}

export function TrackerPanel({ r, set, a, t, now }: { r: Recipe; set: (p: Partial<Recipe>) => void; a: Analysis; t: TrackerStatus; now: number }) {
  const log: BatchLog = { ...EMPTY_LOG, ...r.log };
  const upd = (p: Partial<BatchLog>) => set({ log: { ...log, ...p } });
  const [sg, setSg] = useState(Number((t.latest?.sg ?? a.og).toFixed(3)));
  const [at, setAt] = useState(toLocal(now));
  const [confirmClear, setConfirmClear] = useState(false);
  const latestSg = t.latest?.sg ?? a.og;
  useEffect(() => setSg(Number(latestSg.toFixed(3))), [latestSg]);
  const doseG = (n: number) => {
    const d = a.schedule.doses[n - 1];
    return [d.fermaidO && `${d.fermaidO.toFixed(1)} g Fermaid O`, d.fermaidK && `${d.fermaidK.toFixed(1)} g Fermaid K`, d.dap && `${d.dap.toFixed(1)} g DAP`].filter(Boolean).join(' + ');
  };
  return (
    <Card title="Batch Log" icon="📓" id="log">
      {!t.started ? (
        <div className="flex flex-col items-start gap-2 text-sm">
          <p className="text-stone-600 dark:text-stone-300">Pitched your yeast? Start the log for a live nutrient timeline, gravity chart and stuck-ferment detection.</p>
          <button className="btn-primary" onClick={() => upd({ pitchedAt: new Date(now).toISOString(), readings: [{ uid: uid(), at: new Date(now).toISOString(), sg: Number(a.og.toFixed(3)), note: 'OG (planned)' }] })}>I pitched just now</button>
          <label className="flex items-center gap-2 text-xs text-stone-500">
            or pitched at
            <input type="datetime-local" aria-label="Pitch time" onChange={(e) => e.target.value && upd({ pitchedAt: new Date(e.target.value).toISOString() })} />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Day" value={t.days.toFixed(1)} sub={`pitched ${fmtWhen(Date.parse(log.pitchedAt!))}`} />
            <Stat label="Gravity" value={(t.latest?.sg ?? t.measuredOg).toFixed(3)} sub={`OG ${t.measuredOg.toFixed(3)}`} />
            <Stat label="ABV so far" tone="accent" value={`${t.currentAbv.toFixed(1)} %`} sub="Alternative eq." />
            <Stat label="Sugar used" value={`${Math.max(0, t.attenuationPct).toFixed(0)} %`} sub={`of ${(t.measuredOg - 1) * 1000 > 0 ? ((t.measuredOg - 1) * 1000).toFixed(0) : 0} pts`} />
          </div>
          <p className="rounded-lg bg-stone-100 p-2 text-sm dark:bg-stone-800/60"><b className="capitalize">{t.stage}.</b> {t.message}</p>
          <Chart t={t} fg={a.fg.fg} og={t.measuredOg} />
          <div>
            <h3 className="label mb-1">Nutrient timeline</h3>
            <ul className="flex flex-col gap-1.5">
              {t.doses.map((d) => (
                <li key={d.n} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" id={`dose-${d.n}`} checked={log.dosesDone[d.n - 1] ?? false} onChange={(e) => { const dd = [...log.dosesDone]; dd[d.n - 1] = e.target.checked; upd({ dosesDone: dd }); }} />
                  <label htmlFor={`dose-${d.n}`} className="min-w-0 flex-1">
                    <span className="font-medium">#{d.n} · {d.label}</span>
                    <span className="block text-xs text-stone-500">{doseG(d.n) || 'no nutrient needed'}{d.n === 4 ? ` · at SG ≤ ${t.breakSg.toFixed(3)} or ${fmtWhen(d.dueAt)}` : ` · ${fmtWhen(d.dueAt)}`}</span>
                  </label>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${DOSE_STYLE[d.state]}`}>{d.state}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="label mb-1">Add a reading</h3>
            <div className="flex flex-wrap items-end gap-2">
              <NumberField className="w-28" label="SG" value={sg} onChange={setSg} step={0.001} min={0.98} max={1.2} decimals={3} />
              <label className="flex flex-col gap-1"><span className="label">When</span><input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></label>
              <button className="btn-primary" onClick={() => upd({ readings: [...log.readings, { uid: uid(), at: new Date(at || toLocal(Date.now())).toISOString(), sg }] })}>Log it</button>
            </div>
          </div>
          {log.readings.length > 0 && (
            <ul className="tabular divide-y divide-stone-200 text-sm dark:divide-stone-800">
              {[...log.readings].sort((x, y) => Date.parse(y.at) - Date.parse(x.at)).map((rd) => (
                <li key={rd.uid} className="flex items-center justify-between gap-2 py-1">
                  <span>{new Date(rd.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="font-semibold">{rd.sg.toFixed(3)}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-stone-500">{rd.note}</span>
                  <RemoveButton label="Delete reading" onClick={() => upd({ readings: log.readings.filter((x) => x.uid !== rd.uid) })} />
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            {confirmClear ? (
              <span className="flex gap-1"><button className="btn-primary" onClick={() => { set({ log: EMPTY_LOG }); setConfirmClear(false); }}>Clear log</button><button className="btn-ghost" onClick={() => setConfirmClear(false)}>Cancel</button></span>
            ) : (
              <button className="btn-ghost text-xs" onClick={() => setConfirmClear(true)}>Start over</button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
