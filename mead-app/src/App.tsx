import { useCallback, useEffect, useMemo, useState } from 'react';
import { analyzeRecipe, DEFAULT_RECIPE, Recipe } from './lib/recipe';
import type { UnitSystem } from './lib/units';
import { BatchPanel } from './components/BatchPanel';
import { FermentablesPanel, FruitPanel, SpicePanel } from './components/IngredientsPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { NutrientPanel } from './components/NutrientPanel';
import { AdvisorPanel } from './components/AdvisorPanel';
import { AbvCalculator, AbvProofView } from './components/AbvProof';
import { SourcesList } from './components/SourcesList';
import { SulfitePanel } from './components/SulfitePanel';
import { ExportPanel } from './components/ExportPanel';
import { Modal } from './components/ui';
import { uid, unitHelpers } from './components/units';

const STORE = 'mead-lab:v1';

function load(): { recipe: Recipe; units: UnitSystem } {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const p = JSON.parse(raw);
      return { recipe: { ...DEFAULT_RECIPE, ...p.recipe }, units: p.units === 'imperial' ? 'imperial' : 'metric' };
    }
  } catch {
    /* storage unavailable — fall back to defaults */
  }
  return { recipe: DEFAULT_RECIPE, units: 'metric' };
}

export default function App() {
  const [initial] = useState(load);
  const [recipe, setRecipe] = useState<Recipe>(initial.recipe);
  const [units, setUnits] = useState<UnitSystem>(initial.units);
  const [modal, setModal] = useState<null | 'proof' | 'sources' | 'calc' | 'export'>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ recipe, units }));
    } catch {
      /* ignore */
    }
  }, [recipe, units]);

  const set = useCallback((p: Partial<Recipe>) => setRecipe((r) => ({ ...r, ...p })), []);
  const uh = useMemo(() => unitHelpers(units), [units]);

  const { analysis, error } = useMemo(() => {
    try {
      return { analysis: analyzeRecipe(recipe), error: '' };
    } catch (e) {
      return { analysis: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [recipe]);

  const V = analysis?.whole.volumeL ?? recipe.targetVolumeL;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="sticky top-0 z-40 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-50/90 px-4 py-3 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight">🍯 Mead Lab</h1>
          <p className="truncate text-xs text-stone-500">{recipe.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <div className="flex rounded-md bg-stone-200 p-0.5 text-xs dark:bg-stone-800" role="group" aria-label="Unit system">
            {(['metric', 'imperial'] as const).map((u) => (
              <button key={u} onClick={() => setUnits(u)} aria-pressed={units === u} className={`rounded px-2 py-1 font-medium capitalize ${units === u ? 'bg-white shadow dark:bg-stone-600' : 'text-stone-500'}`}>
                {u}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => setModal('export')} disabled={!analysis}>Export</button>
          <button className="btn-ghost" onClick={() => setModal('calc')}>ABV calc</button>
          <button className="btn-ghost" onClick={() => setModal('sources')}>Sources</button>
          {confirmReset ? (
            <span className="flex items-center gap-1 text-xs">
              <button className="btn-primary" onClick={() => { setRecipe(DEFAULT_RECIPE); setConfirmReset(false); }}>Reset recipe</button>
              <button className="btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
            </span>
          ) : (
            <button className="btn-ghost" onClick={() => setConfirmReset(true)}>Reset</button>
          )}
        </div>
      </header>

      {error && <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">Calculation error: {error}</div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <BatchPanel r={recipe} set={set} uh={uh} />
          <FermentablesPanel r={recipe} set={set} uh={uh} a={analysis} />
          <FruitPanel r={recipe} set={set} uh={uh} a={analysis} />
          <SpicePanel r={recipe} set={set} uh={uh} a={analysis} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {analysis && (
            <>
              <ResultsPanel a={analysis} uh={uh} onProof={() => setModal('proof')} />
              <AdvisorPanel
                a={analysis}
                onAddSpice={(spiceId, gpl) => set({ spices: [...recipe.spices, { uid: uid(), spiceId, grams: Number((gpl * V).toFixed(2)) }] })}
                onAddFruit={(fruitId) => set({ fruits: [...recipe.fruits, { uid: uid(), fruitId, massKg: Number((0.2 * V).toFixed(2)), stage: 'secondary' }] })}
              />
              <NutrientPanel a={analysis} />
              <SulfitePanel r={recipe} set={set} a={analysis} uh={uh} />
            </>
          )}
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-stone-500">
        Guidance, not gospel: verify with a hydrometer, a pH meter and bench trials. Math per <code>mead_app_spec.md</code>.
      </footer>

      <Modal open={modal === 'proof'} onClose={() => setModal(null)} title="ABV — mathematical proof & origin">
        {analysis && <AbvProofView og={analysis.effectiveOg} fg={analysis.fg.fg} />}
      </Modal>
      <Modal open={modal === 'calc'} onClose={() => setModal(null)} title="ABV calculator (measured readings)">
        <AbvCalculator />
      </Modal>
      <Modal open={modal === 'export'} onClose={() => setModal(null)} title="Export to Excel / Google Sheets">
        {analysis && <ExportPanel a={analysis} />}
      </Modal>
      <Modal open={modal === 'sources'} onClose={() => setModal(null)} title="Sources & citations">
        <SourcesList />
      </Modal>
    </div>
  );
}
