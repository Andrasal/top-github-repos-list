import { ELDER } from './elder';
import { YOUNGER } from './younger';
import type { Rune } from './types';

export { ELDER, YOUNGER };
export { STAVES } from './staves';
export { INTENTS, CONFLICTS } from './intents';
export * from './types';

export const ALL_RUNES: Rune[] = [...ELDER, ...YOUNGER];

const BY_ID = new Map(ALL_RUNES.map((r) => [r.id, r]));

export function getRune(id: string): Rune {
  const r = BY_ID.get(id);
  if (!r) throw new Error(`Unknown rune id: ${id}`);
  return r;
}
