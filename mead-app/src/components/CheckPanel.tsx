import type { Advisory } from '../lib/flavor';
import { AdvisoryItem } from './AdvisorPanel';

export function CheckPanel({ flags }: { flags: Advisory[] }) {
  if (flags.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <div className="text-4xl" aria-hidden>✅</div>
        <p className="font-semibold">All clear</p>
        <p className="max-w-sm text-sm text-stone-500">No limits exceeded and no risky doses. Suggestions and pairing ideas are in the Mead Maker's Brain.</p>
      </div>
    );
  }
  const errors = flags.filter((f) => f.severity === 'error').length;
  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-600 dark:text-stone-300">
        {errors > 0 ? `${errors} must-fix issue${errors > 1 ? 's' : ''}` : 'No must-fix issues'}
        {flags.length - errors > 0 ? ` and ${flags.length - errors} thing${flags.length - errors > 1 ? 's' : ''} to review.` : '.'}
      </p>
      <ul className="flex flex-col gap-2">{flags.map((f) => <AdvisoryItem key={f.id} x={f} />)}</ul>
    </div>
  );
}
