import { SOURCES } from '../lib/sources';

export function SourcesList() {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-stone-600 dark:text-stone-300">
        Every constant, formula and database row in this app is tagged with one of these sources. The full spec, with section references, is in{' '}
        <code>mead_app_spec.md</code>.
      </p>
      <ul className="space-y-2">
        {Object.values(SOURCES).map((s) => (
          <li key={s.id} className="rounded-lg border border-stone-200 p-2 dark:border-stone-800">
            <div className="flex items-center justify-between gap-2">
              <b>{s.short}</b>
              <code className="text-[10px] text-stone-400">{s.id}</code>
            </div>
            <div className="text-stone-700 dark:text-stone-300">{s.citation}</div>
            {s.note && <div className="mt-1 text-xs text-stone-500">{s.note}</div>}
            {s.url && (
              <a href={s.url} target="_blank" rel="noreferrer" className="mt-1 inline-block break-all text-xs text-honey-700 underline dark:text-honey-300">
                {s.url}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
