import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { analyzeRecipe, DEFAULT_RECIPE, DEFAULT_SULFITE, Recipe } from './lib/recipe';
import type { UnitSystem } from './lib/units';
import { EMPTY_LOG, trackerStatus } from './lib/tracker';
import { collectFlags } from './lib/flags';
import { BatchPanel } from './components/BatchPanel';
import { BotanicalPanel, FermentablesPanel, FruitPanel } from './components/IngredientsPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { NutrientPanel } from './components/NutrientPanel';
import { AdvisorPanel } from './components/AdvisorPanel';
import { AbvCalculator, AbvProofView } from './components/AbvProof';
import { SourcesList } from './components/SourcesList';
import { SulfitePanel } from './components/SulfitePanel';
import { ExportPanel } from './components/ExportPanel';
import { CheckPanel } from './components/CheckPanel';
import { PresetPicker } from './components/PresetPicker';
import { TrackerPanel } from './components/TrackerPanel';
import { Modal } from './components/ui';
import { uid, unitHelpers } from './components/units';

const STORE = 'mead-lab:v1';
type ModalId = null | 'proof' | 'sources' | 'calc' | 'export' | 'check' | 'styles';

function load(): { recipe: Recipe; units: UnitSystem } {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const p = JSON.parse(raw);
      const recipe: Recipe = { ...DEFAULT_RECIPE, ...p.recipe };
      recipe.sulfite = { ...DEFAULT_SULFITE, ...recipe.sulfite };
      recipe.log = { ...EMPTY_LOG, ...recipe.log };
      return { recipe, units: p.units === 'imperial' ? 'imperial' : 'metric' };
    }
  } catch {
    /* storage unavailable — fall back to defaults */
  }
  return { recipe: DEFAULT_RECIPE, units: 'metric' };
}

const NAV = [
  { id: 'recipe', label: 'Recipe' },
  { id: 'results', label: 'Results' },
  { id: 'brain', label: 'Brain' },
  { id: 'nutrients', label: 'Nutrients' },
  { id: 'sulfite', label: 'Sulfite' },
  { id: 'log', label: 'Log' },
];

export default function App() {
  const [initial] = useState(load);
  const [recipe, setRecipe] = useState<Recipe>(initial.recipe);
  const [units, setUnits] = useState<UnitSystem>(initial.units);
  const [modal, setModal] = useState<ModalId>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ recipe, units }));
    } catch {
      /* ignore */
    }
  }, [recipe, units]);

  const set = useCallback((p: Partial<Recipe>) => setRecipe((r) => ({ ...r, ...p })), []);
  const uh = useMemo(() => unitHelpers(units), [units]);

  // Typing stays instant: the (heavier) analysis follows a deferred copy of the recipe
  const deferred = useDeferredValue(recipe);
  const { analysis, error } = useMemo(() => {
    try {
      return { analysis: analyzeRecipe(deferred), error: '' };
    } catch (e) {
      return { analysis: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [deferred]);

  const tracker = useMemo(
    () => (analysis ? trackerStatus({ ...EMPTY_LOG, ...recipe.log }, analysis.og, analysis.fg.fg, now) : null),
    [analysis, recipe.log, now],
  );
  const flags = useMemo(() => (analysis ? collectFlags(analysis.advisories, tracker) : []), [analysis, tracker]);
  const hasError = flags.some((f) => f.severity === 'error');
  const V = analysis?.whole.volumeL ?? recipe.targetVolumeL;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="sticky top-0 z-40 -mx-4 mb-4 border-b border-stone-200 bg-stone-50/90 px-4 pb-2 pt-3 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight">🍯 Mead Lab</h1>
            <p className="truncate text-xs text-stone-500">{recipe.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button className="btn-ghost relative border border-stone-300 dark:border-stone-700" onClick={() => setModal('check')} aria-label={`Check recipe: ${flags.length} item${flags.length === 1 ? '' : 's'}`}>
              Check recipe
              {flags.length > 0 && (
                <span className={`tabular rounded-full px-1.5 text-[11px] font-bold ${hasError ? 'bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900' : 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-100'}`}>{flags.length}</span>
              )}
            </button>
            <button className="btn-ghost" onClick={() => setModal('styles')}>Styles</button>
            <button className="btn-primary" onClick={() => setModal('export')} disabled={!analysis}>Export</button>
          </div>
        </div>
        {analysis && (
          <div className="tabular mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span><span className="text-stone-500">OG</span> <b>{analysis.og.toFixed(3)}</b></span>
            <span><span className="text-stone-500">FG</span> <b>{analysis.fg.fg.toFixed(3)}</b></span>
            <span><span className="text-stone-500">ABV</span> <b className="text-honey-700 dark:text-honey-300">{analysis.abv.toFixed(1)} %</b></span>
            <span className="capitalize text-stone-600 dark:text-stone-300">{analysis.sweetness}</span>
            <span className="inline-block h-3 w-3 rounded-full border border-stone-300 dark:border-stone-600" style={{ background: analysis.color.hex }} title={analysis.color.name} aria-hidden />
          </div>
        )}
        <nav className="-mx-1 mt-2 flex gap-1 overflow-x-auto pb-0.5 text-xs" aria-label="Sections">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} className="shrink-0 rounded-full bg-stone-200/70 px-2.5 py-1 font-medium text-stone-700 hover:bg-honey-200 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-honey-900/50">{n.label}</a>
          ))}
          <span className="ml-auto flex shrink-0 items-center gap-1">
            <span className="flex rounded-md bg-stone-200 p-0.5 dark:bg-stone-800" role="group" aria-label="Unit system">
              {(['metric', 'imperial'] as const).map((u) => (
                <button key={u} onClick={() => setUnits(u)} aria-pressed={units === u} className={`rounded px-2 py-0.5 font-medium capitalize ${units === u ? 'bg-white shadow dark:bg-stone-600' : 'text-stone-500'}`}>{u}</button>
              ))}
            </span>
          </span>
        </nav>
      </header>

      {error && <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">Calculation error: {error}</div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex min-w-0 flex-col gap-4" id="recipe">
          <BatchPanel r={recipe} set={set} replace={setRecipe} uh={uh} />
          <FermentablesPanel r={recipe} set={set} uh={uh} a={analysis} />
          <FruitPanel r={recipe} set={set} uh={uh} a={analysis} />
          <BotanicalPanel r={recipe} set={set} uh={uh} a={analysis} kind="flowers" />
          <BotanicalPanel r={recipe} set={set} uh={uh} a={analysis} kind="spices" />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {analysis && tracker && (
            <>
              <ResultsPanel a={analysis} uh={uh} onProof={() => setModal('proof')} />
              <AdvisorPanel
                a={analysis}
                onAddSpice={(spiceId, gpl) => set({ spices: [...recipe.spices, { uid: uid(), spiceId, grams: Number((gpl * V).toFixed(2)) }] })}
                onAddFruit={(fruitId) => set({ fruits: [...recipe.fruits, { uid: uid(), fruitId, massKg: Number((0.2 * V).toFixed(2)), stage: 'secondary' }] })}
              />
              <NutrientPanel a={analysis} />
              <SulfitePanel r={recipe} set={set} a={analysis} uh={uh} />
              <TrackerPanel r={recipe} set={set} a={analysis} t={tracker} now={now} />
            </>
          )}
        </div>
      </div>

      <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-stone-500">
        <span>Guidance, not gospel: verify with a hydrometer, a pH meter and bench trials.</span>
        <button className="underline" onClick={() => setModal('calc')}>ABV calculator</button>
        <button className="underline" onClick={() => setModal('sources')}>Sources & licences</button>
        {confirmReset ? (
          <span className="flex items-center gap-1">
            <button className="btn-primary" onClick={() => { setRecipe(DEFAULT_RECIPE); setConfirmReset(false); }}>Reset everything</button>
            <button className="btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
          </span>
        ) : (
          <button className="underline" onClick={() => setConfirmReset(true)}>Reset</button>
        )}
      </footer>

      <Modal open={modal === 'check'} onClose={() => setModal(null)} title="Recipe check">
        <CheckPanel flags={flags} />
      </Modal>
      <Modal open={modal === 'styles'} onClose={() => setModal(null)} title="Start from a style">
        <PresetPicker current={recipe} onPick={(r) => { setRecipe({ ...r, log: recipe.log }); setModal(null); }} />
      </Modal>
      <Modal open={modal === 'proof'} onClose={() => setModal(null)} title="ABV: the maths and where it comes from">
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
