import type { Analysis } from '../lib/recipe';
import type { Advisory } from '../lib/flavor';
import { TA_TARGETS } from '../lib/flavor';
import { isFlag } from '../lib/flags';
import { AXES } from '../lib/profile';
import { Card, Cite, Tip } from './ui';

function Radar({ profile }: { profile: Analysis['profile'] }) {
  const size = 260, c = size / 2, R = 88;
  const pt = (i: number, v: number) => {
    const ang = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
    return [c + Math.cos(ang) * R * (v / 10), c + Math.sin(ang) * R * (v / 10)];
  };
  const poly = AXES.map((k, i) => pt(i, profile[k]).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[17rem]" role="img" aria-label={`Flavour profile: ${AXES.map((k) => `${k} ${profile[k].toFixed(1)}`).join(', ')}`}>
      {[2.5, 5, 7.5, 10].map((v) => (
        <polygon key={v} points={AXES.map((_, i) => pt(i, v).join(',')).join(' ')} className="fill-none stroke-stone-200 dark:stroke-stone-700" strokeWidth={1} />
      ))}
      {AXES.map((_, i) => { const [x, y] = pt(i, 10); return <line key={i} x1={c} y1={c} x2={x} y2={y} className="stroke-stone-200 dark:stroke-stone-700" strokeWidth={1} />; })}
      <polygon points={poly} className="fill-honey-400/40 stroke-honey-600 dark:fill-honey-500/30 dark:stroke-honey-400" strokeWidth={2} strokeLinejoin="round" />
      {AXES.map((k, i) => { const [x, y] = pt(i, profile[k]); return <circle key={k} cx={x} cy={y} r={3} className="fill-honey-600 dark:fill-honey-400" />; })}
      {AXES.map((k, i) => {
        const [x, y] = pt(i, 12.6);
        return <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-stone-500 text-[10px] font-medium dark:fill-stone-400">{k}</text>;
      })}
    </svg>
  );
}

function Glass({ color, name }: { color: string; name: string }) {
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 80 120" className="h-28 w-auto" role="img" aria-label={`Estimated colour: ${name}`}>
        <defs>
          <clipPath id="bowl"><path d="M14 8 H66 C66 48 58 66 40 70 C22 66 14 48 14 8 Z" /></clipPath>
        </defs>
        <rect x="10" y="26" width="60" height="50" fill={color} clipPath="url(#bowl)" />
        <path d="M14 8 H66 C66 48 58 66 40 70 C22 66 14 48 14 8 Z" className="fill-none stroke-stone-400 dark:stroke-stone-500" strokeWidth={2} />
        <path d="M22 30 C22 46 26 56 32 60" className="fill-none stroke-white/60" strokeWidth={3} strokeLinecap="round" />
        <path d="M40 70 V104 M26 108 H54" className="stroke-stone-400 dark:stroke-stone-500" strokeWidth={2.5} strokeLinecap="round" />
      </svg>
      <figcaption className="text-xs capitalize text-stone-500">{name}</figcaption>
    </figure>
  );
}

const SEV = {
  error: { icon: '⛔', cls: 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40' },
  warning: { icon: '⚠️', cls: 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40' },
  tip: { icon: '💡', cls: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' },
  info: { icon: 'ℹ️', cls: 'border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900' },
} as const;

export function AdvisoryItem({ x }: { x: Advisory }) {
  return (
    <li className={`rounded-lg border p-2.5 text-sm ${SEV[x.severity].cls}`}>
      <div className="flex items-start gap-2">
        <span aria-label={x.severity}>{SEV[x.severity].icon}</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{x.title}</div>
          <div className="text-stone-700 dark:text-stone-300">{x.detail}</div>
          {x.suggestion && <div className="mt-1 text-stone-900 dark:text-stone-100">→ {x.suggestion}</div>}
          <div className="mt-1"><Cite ids={x.source} /></div>
        </div>
      </div>
    </li>
  );
}

export function AdvisorPanel({ a, onAddSpice, onAddFruit }: { a: Analysis; onAddSpice: (id: string, gPerL: number) => void; onAddFruit: (id: string) => void }) {
  const [taMin, taMax] = TA_TARGETS[a.sweetness];
  const suggestions = a.advisories.filter((x) => !isFlag(x));
  return (
    <Card title="Mead Maker's Brain" icon="🧠" id="brain">
      <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto]">
        <Radar profile={a.profile} />
        <Glass color={a.color.hex} name={a.color.name} />
      </div>
      <blockquote className="mt-2 rounded-lg bg-honey-50 p-3 text-sm italic leading-relaxed text-stone-800 dark:bg-honey-900/20 dark:text-stone-100">
        “{a.tastingNote}”
        <span className="ml-1 inline-flex align-middle not-italic"><Tip>A predicted profile built from the recipe's numbers: residual sugar, acid, alcohol, tannin and how hard each ingredient sits in its dose band. It's for comparing recipes, not a guarantee of taste.</Tip></span>
      </blockquote>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-stone-100 p-2 dark:bg-stone-800/60"><div className="label">Fruit load</div><div className="tabular text-base font-semibold">{a.fruitLoad.toFixed(2)} kg/L</div></div>
        <div className="rounded-lg bg-stone-100 p-2 dark:bg-stone-800/60"><div className="label">Est. TA</div><div className="tabular text-base font-semibold">{a.ta.toFixed(1)} g/L</div><div className="text-stone-500">target {taMin}–{taMax}</div></div>
        <div className="rounded-lg bg-stone-100 p-2 dark:bg-stone-800/60"><div className="label">Colour</div><div className="text-base font-semibold capitalize">{a.color.name}</div></div>
      </div>
      {suggestions.length > 0 && (
        <details className="mt-3" open>
          <summary className="label cursor-pointer">Suggestions ({suggestions.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">{suggestions.map((x) => <AdvisoryItem key={x.id} x={x} />)}</ul>
        </details>
      )}
      {a.suggestions.length > 0 && (
        <div className="mt-4">
          <h3 className="label mb-2">Pairing ideas</h3>
          <ul className="flex flex-col gap-1.5">
            {a.suggestions.map((s) => (
              <li key={s.forId + s.partnerId} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <b>{s.forName}</b> + {s.partnerName}
                  <span className="block text-xs text-stone-500">{s.note}{s.startDoseGPerL != null && ` Start at ${s.startDoseGPerL} g/L.`}</span>
                </span>
                <button className="btn-ghost shrink-0 text-honey-700 dark:text-honey-300" onClick={() => (s.startDoseGPerL != null ? onAddSpice(s.partnerId, s.startDoseGPerL) : onAddFruit(s.partnerId))}>+ Add</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
