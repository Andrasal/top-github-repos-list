import type { LibraryEntry } from '../lib/library';

export function DraftBar({ base, nextVersion, dirty, onSaveVersion, onSaveNew, saving }: {
  base: LibraryEntry | null; nextVersion: number; dirty: boolean; saving: boolean; onSaveVersion: () => void; onSaveNew: () => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-stone-100 px-2 py-1.5 text-xs dark:bg-stone-800/70">
      <span className="min-w-0 flex-1 truncate">
        {base ? <>Copy of <b>{base.name} v{base.version}</b></> : <b>Not saved yet</b>}
        {dirty ? <span className="text-honey-700 dark:text-honey-300"> · unsaved changes</span> : base ? <span className="text-stone-500"> · no changes</span> : null}
      </span>
      {base ? (
        <>
          <button className="btn-primary px-2 py-1 text-xs" disabled={!dirty || saving} onClick={onSaveVersion}>Save as v{nextVersion}</button>
          <button className="btn-ghost px-2 py-1 text-xs" disabled={saving} onClick={onSaveNew}>Save as new recipe</button>
        </>
      ) : (
        <button className="btn-primary px-2 py-1 text-xs" disabled={saving} onClick={onSaveNew}>Save to library</button>
      )}
    </div>
  );
}
