import { useMemo, useRef, useState } from 'react';
import type { Analysis } from '../lib/recipe';
import { shoppingList, shoppingText } from '../lib/shopping';
import { copyText } from './download';
import { Card } from './ui';
import type { UnitHelpers } from './units';

/** SPEC §31 — what to buy and weigh out, generated from the recipe. */
export function ShoppingCard({ a, uh, defaultOpen = true }: { a: Analysis; uh: UnitHelpers; defaultOpen?: boolean }) {
  const groups = useMemo(() => shoppingList(a, { vol: (l) => uh.fmtVol(l, 1), mass: (kg) => uh.fmtMass(kg) }), [a, uh]);
  const [copied, setCopied] = useState(false);
  const fallback = useRef<HTMLTextAreaElement>(null);
  const copy = async () => {
    const ok = await copyText(shoppingText(a.recipe.name, groups), fallback.current);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Card title="Shopping list" icon="🛒" actions={<button type="button" className="btn-ghost border border-stone-300 text-xs dark:border-stone-700" onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>}>
      <details open={defaultOpen}>
        <summary className="cursor-pointer select-none text-sm text-stone-500">{groups.reduce((n, g) => n + g.items.length, 0)} items for {uh.fmtVol(a.primary.volumeL, 1)}</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.title}>
              <h3 className="label mb-1">{g.title}</h3>
              <ul className="space-y-0.5 text-sm">
                {g.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-2">
                    <span className="min-w-0">{i.name}{i.note && <span className="text-xs text-stone-500"> · {i.note}</span>}</span>
                    <span className="tabular shrink-0 font-medium">{i.amount}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
      <textarea ref={fallback} hidden readOnly className="mt-2 h-32 w-full text-xs" aria-label="Shopping list text" />
    </Card>
  );
}
