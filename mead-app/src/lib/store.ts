/**
 * Library persistence — SPEC §23.2.
 * Inside Claude: the artifact `db` capability, under the viewer's PRIVATE subtree
 * (data/users/<id>/meadlab/library/recipes/<entryId>) — synced across devices, invisible to others.
 * Elsewhere (local dev, signed out): browser localStorage, clearly labelled as this-browser-only.
 */
import type { LibraryEntry } from './library';

export interface LibraryStore {
  kind: 'cloud' | 'local';
  subscribe(cb: (entries: LibraryEntry[]) => void, onError?: (msg: string) => void): () => void;
  put(entry: LibraryEntry): Promise<void>;
  remove(id: string): Promise<void>;
}

const LOCAL_KEY = 'mead-lab:library:v1';

export function localStore(storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeLocalStorage()): LibraryStore {
  const listeners = new Set<(e: LibraryEntry[]) => void>();
  let memory: LibraryEntry[] = [];
  const read = (): LibraryEntry[] => {
    try {
      const raw = storage?.getItem(LOCAL_KEY);
      return raw ? (JSON.parse(raw) as LibraryEntry[]) : memory;
    } catch {
      return memory;
    }
  };
  const write = (entries: LibraryEntry[]) => {
    memory = entries;
    try { storage?.setItem(LOCAL_KEY, JSON.stringify(entries)); } catch { /* quota or blocked: keep in memory */ }
    listeners.forEach((l) => l(entries));
  };
  return {
    kind: 'local',
    subscribe(cb) { listeners.add(cb); cb(read()); return () => listeners.delete(cb); },
    async put(entry) { write([...read().filter((e) => e.id !== entry.id), entry]); },
    async remove(id) { write(read().filter((e) => e.id !== id)); },
  };
}

function safeLocalStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

// Minimal structural types for the parts of the runtime we use (see artifact-capabilities d.ts)
type Snap = { docs: { id: string; data(): Record<string, unknown> | undefined }[] };
type Coll = {
  doc(id: string): { set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> };
  onSnapshot(next: (s: Snap) => void, err?: (e: { code: string; message: string }) => void): () => void;
};
type Db = { doc(path: string): { collection(p: string): Coll } };
type UserNs = { id(): Promise<string | null> };
type ClaudeRt = { use(name: string): Promise<unknown> };

export async function openStore(): Promise<LibraryStore> {
  const rt = (globalThis as unknown as { claude?: ClaudeRt }).claude;
  if (!rt?.use) return localStore();
  try {
    const [db, user] = (await Promise.all([rt.use('db'), rt.use('user')])) as [Db | null, UserNs | null];
    const uid = db && user ? await user.id() : null;
    if (!db || !uid) return localStore();
    const coll = db.doc(`data/users/${uid}/meadlab/library`).collection('recipes');
    return {
      kind: 'cloud',
      subscribe(cb, onError) {
        return coll.onSnapshot(
          (s) => cb(s.docs.map((d) => d.data() as unknown as LibraryEntry).filter((e) => e && e.id && e.recipe)),
          (e) => onError?.(e.code === 'quota_exceeded' ? 'Your recipe library is full. Delete old versions to save new ones.' : `Library unavailable (${e.code}).`),
        );
      },
      async put(entry) { await coll.doc(entry.id).set(JSON.parse(JSON.stringify(entry))); },
      async remove(id) { await coll.doc(id).delete(); },
    };
  } catch {
    return localStore();
  }
}
