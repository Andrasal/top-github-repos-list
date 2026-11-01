import { createContext, ReactNode, useContext } from 'react';

/**
 * Detail level (SPEC §31): "simple" keeps each step to what a brewer acts on; "expert" shows the
 * workings (model inputs, contribution tables, citations). Nothing is removed in simple mode:
 * larger blocks fold behind "More detail".
 */
export type Detail = 'simple' | 'expert';
export const DetailContext = createContext<Detail>('expert');
export const useExpert = () => useContext(DetailContext) === 'expert';

/** Inline: shown only in expert mode. */
export function ExpertOnly({ children }: { children: ReactNode }) {
  return useExpert() ? <>{children}</> : null;
}

/** Block: inline in expert mode, folded behind a summary in simple mode. */
export function MoreDetail({ children, label = 'More detail' }: { children: ReactNode; label?: string }) {
  if (useExpert()) return <>{children}</>;
  return (
    <details className="group rounded-lg border border-dashed border-stone-300 px-3 py-2 dark:border-stone-700">
      <summary className="cursor-pointer select-none text-xs font-medium text-stone-500 group-open:mb-2">{label}</summary>
      {children}
    </details>
  );
}
