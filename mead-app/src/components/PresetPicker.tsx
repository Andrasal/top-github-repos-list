import { PRESETS, PRESET_BASE_VOLUME_L, Preset } from '../lib/presets';
import { DEFAULT_RECIPE, Recipe } from '../lib/recipe';
import { scaleRecipe } from '../lib/designer';
import { uid } from './units';

export function PresetPicker({ current, onPick, compact = false }: { current: Recipe; onPick: (r: Recipe) => void; compact?: boolean }) {
  const apply = (p: Preset) => {
    const base: Recipe = {
      ...DEFAULT_RECIPE,
      ...p.recipe,
      honeys: p.recipe.honeys.map((h) => ({ ...h, uid: uid() })),
      fruits: p.recipe.fruits.map((f) => ({ ...f, uid: uid() })),
      spices: p.recipe.spices.map((s) => ({ ...s, uid: uid() })),
      mode: 'targetVolume',
      targetVolumeL: PRESET_BASE_VOLUME_L,
      protocol: current.protocol,
      dryFg: current.dryFg,
    };
    const vol = current.mode === 'targetVolume' ? current.targetVolumeL : PRESET_BASE_VOLUME_L;
    onPick(scaleRecipe(base, vol / PRESET_BASE_VOLUME_L));
  };
  if (compact) {
    return (
      <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" aria-label="Style presets">
        {PRESETS.map((p) => (
          <li key={p.id} className="w-40 shrink-0 snap-start">
            <button onClick={() => apply(p)} className="flex h-full w-full flex-col gap-1 rounded-xl border border-stone-200 bg-white p-2.5 text-left transition hover:border-honey-400 hover:bg-honey-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-honey-900/20">
              <span className="text-2xl" aria-hidden>{p.emoji}</span>
              <span className="text-sm font-semibold leading-tight">{p.name}</span>
              <span className="line-clamp-2 text-[11px] leading-snug text-stone-500">{p.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-600 dark:text-stone-300">Start from a proven style. It's scaled to your current batch size and you can change anything afterwards.</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {PRESETS.map((p) => (
          <li key={p.id}>
            <button onClick={() => apply(p)} className="flex h-full w-full items-start gap-3 rounded-xl border border-stone-200 p-3 text-left transition hover:border-honey-400 hover:bg-honey-50 focus-visible:ring-2 focus-visible:ring-honey-400 dark:border-stone-800 dark:hover:bg-honey-900/20">
              <span className="text-2xl" aria-hidden>{p.emoji}</span>
              <span className="min-w-0">
                <span className="block font-semibold">{p.name}</span>
                <span className="block text-xs text-stone-500 dark:text-stone-400">{p.blurb}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
