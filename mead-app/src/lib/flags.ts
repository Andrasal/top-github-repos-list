/** Recipe check — SPEC §16. Warnings and errors are collected here and only shown on request. */
import type { Advisory } from './flavor';
import type { TrackerStatus } from './tracker';

export const isFlag = (a: Advisory) => a.severity === 'warning' || a.severity === 'error';

export function collectFlags(advisories: Advisory[], tracker?: TrackerStatus | null): Advisory[] {
  const flags = advisories.filter(isFlag);
  if (tracker?.stage === 'stuck') flags.push({ id: 'tracker-stuck', severity: 'warning', category: 'process', title: 'Fermentation may be stuck', detail: tracker.message, source: ['practice'] });
  const overdue = tracker?.doses.filter((d) => d.state === 'overdue') ?? [];
  if (overdue.length) flags.push({ id: 'tracker-overdue', severity: 'warning', category: 'process', title: 'Nutrient addition overdue', detail: `Dose ${overdue.map((d) => d.n).join(', ')} is overdue. Add it now unless you are past the ⅓ sugar break; after the break, skip it.`, source: ['tosna'] });
  return flags.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
}
