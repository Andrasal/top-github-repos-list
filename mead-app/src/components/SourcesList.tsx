import { SOURCES, LicenseStatus } from '../lib/sources';

const LIC: Record<LicenseStatus, { label: string; cls: string }> = {
  'public-domain': { label: 'Public domain', cls: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100' },
  'open-reuse': { label: 'Open reuse', cls: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100' },
  'facts-attributed': { label: 'Facts only, cited', cls: 'bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100' },
  'logic-only': { label: 'Logic only, no content', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100' },
  own: { label: 'Our own', cls: 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-100' },
};

export function SourcesList() {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-stone-600 dark:text-stone-300">
        Every constant, formula and database row is tagged with one of these sources. Formulas, methods and numeric facts cannot be copyrighted. This app
        re-implements them from their logic and credits the origin, and copies no third-party text, tables or code. Where a source's terms restrict reuse or
        couldn't be confirmed, only its logic is used. Full audit: <code>mead_app_spec.md</code> §15.
      </p>
      <ul className="space-y-2">
        {Object.values(SOURCES).map((s) => (
          <li key={s.id} className="rounded-lg border border-stone-200 p-2 dark:border-stone-800">
            <div className="flex items-center justify-between gap-2">
              <b>{s.short}</b>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${LIC[s.license].cls}`}>{LIC[s.license].label}</span>
            </div>
            <div className="text-stone-700 dark:text-stone-300">{s.citation}</div>
            {s.note && <div className="mt-1 text-xs text-stone-500">{s.note}</div>}
            <div className="mt-1 text-xs text-stone-600 dark:text-stone-400"><b>Use:</b> {s.usage}</div>
            {s.url && (
              <a href={s.url} target="_blank" rel="noreferrer" className="mt-1 inline-block break-all text-xs text-honey-700 underline dark:text-honey-300">
                {s.url}
              </a>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-stone-500">Fermaid®, Go-Ferm® and Lalvin® are trademarks of Lallemand Inc. Other product and yeast names belong to their owners and are used only to identify products. Not affiliated with or endorsed by any cited organisation.</p>
    </div>
  );
}
