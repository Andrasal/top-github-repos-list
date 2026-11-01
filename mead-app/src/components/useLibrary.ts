import { useEffect, useMemo, useState } from 'react';
import type { LibraryEntry } from '../lib/library';
import { LibraryStore, localStore, openStore } from '../lib/store';

export function useLibrary() {
  const [store, setStore] = useState<LibraryStore | null>(null);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    let unsub: (() => void) | null = null;
    openStore()
      .catch(() => localStore())
      .then((s) => {
        if (!alive) return;
        setStore(s);
        unsub = s.subscribe(setEntries, setError);
      });
    return () => { alive = false; unsub?.(); };
  }, []);

  return useMemo(() => ({
    ready: store != null,
    kind: store?.kind ?? 'local',
    entries,
    error,
    async save(e: LibraryEntry) {
      if (!store) throw new Error('Library is still loading');
      try { await store.put(e); } catch (err) {
        const code = (err as { code?: string })?.code;
        const msg = code === 'quota_exceeded' ? 'Your recipe library is full. Delete old versions first.' : `Could not save (${code ?? 'error'}).`;
        setError(msg);
        throw new Error(msg);
      }
    },
    async remove(id: string) { await store?.remove(id); },
  }), [store, entries, error]);
}
export type Library = ReturnType<typeof useLibrary>;
