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
import { TrackerPanel } from './components/TrackerPanel';
import { AcidityPanel } from './components/AcidityPanel';
import { Modal } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useLibrary } from './components/useLibrary';
import { LibraryPanel } from './components/LibraryPanel';
import { DraftBar } from './components/DraftBar';
import { ChatPanel } from './components/ChatPanel';
import { useAiSettings } from './components/AiConnect';
import { createEntry, deriveEntry, LibraryEntry, normaliseRecipe } from './lib/library';
import { uid, unitHelpers } from './components/units';
import { YeastPanel } from './components/YeastPanel';
import { BenchTrialCard, ReadingTools, SulfiteFromWeight } from './components/CellarTools';
import { BacksweetenPanel } from './components/BacksweetenPanel';
import { BrewDayPanel } from './components/BrewDayPanel';
import { BottlePanel, GlassSvg, PrintSheet } from './components/BottlePanel';
import { PAGES, PageId, GuideBox } from './components/Pages';

const STORE = 'mead-lab:v1';
type ModalId = null | 'proof' | 'sources' | 'calc' | 'export' | 'check' | 'library' | 'chat';

interface Loaded { recipe: Recipe; units: UnitSystem; baseId: string | null; dirty: boolean }
function load(): Loaded {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const p = JSON.parse(raw);
      const recipe: Recipe = { ...DEFAULT_RECIPE, ...p.recipe };
      recipe.sulfite = { ...DEFAULT_SULFITE, ...recipe.sulfite };
      recipe.log = { ...EMPTY_LOG, ...recipe.log };
      recipe.adjustments = recipe.adjustments ?? [];
      recipe.alkalinityCaCO3 = recipe.alkalinityCaCO3 ?? 50;
      return { recipe, units: p.units === 'imperial' ? 'imperial' : 'metric', baseId: p.baseId ?? null, dirty: p.dirty ?? true };
    }
  } catch {
    /* storage unavailable — fall back to defaults */
  }
  return { recipe: DEFAULT_RECIPE, units: 'metric', baseId: null, dirty: false };
}

const UI_STORE = 'mead-lab:ui:v1';
type Theme = 'auto' | 'light' | 'dark';
function loadUi(): { page: PageId; guide: boolean; theme: Theme } {
  try {
    const p = JSON.parse(localStorage.getItem(UI_STORE) ?? '{}');
    return { page: PAGES.some((x) => x.id === p.page) ? p.page : 'plan', guide: p.guide ?? true, theme: ['light', 'dark'].includes(p.theme) ? p.theme : 'auto' };
  } catch { return { page: 'plan', guide: true, theme: 'auto' }; }
}

export default function App() {
  const [initial] = useState(load);
  const [recipe, setRecipe] = useState<Recipe>(initial.recipe);
  const [units, setUnits] = useState<UnitSystem>(initial.units);
  const [modal, setModal] = useState<ModalId>(null);
  const [ui] = useState(loadUi);
  const [page, setPage] = useState<PageId>(ui.page);
  const [guide, setGuide] = useState(ui.guide);
  const [theme, setTheme] = useState<Theme>(ui.theme);
  useEffect(() => {
    try { localStorage.setItem(UI_STORE, JSON.stringify({ page, guide, theme })); } catch { /* ignore */ }
    if (theme === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = theme;
  }, [page, guide, theme]);
  const go = (id: PageId) => { setPage(id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  // Keep the current step's pill visible in the scrolling step bar
  useEffect(() => { document.querySelector('nav[aria-label=Steps] [aria-current=step]')?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [page]);
  // The assistant is locked until the user connects an AI (own key), unless the page runs inside Claude
  const aiKey = useAiSettings();
  const aiLocked = !aiKey && !(window as unknown as { claude?: unknown }).claude;
  const [confirmReset, setConfirmReset] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Draft = an editable COPY. baseId = the saved version it was copied from (never modified).
  const [baseId, setBaseId] = useState<string | null>(initial.baseId);
  const [dirty, setDirty] = useState(initial.dirty);
  const [saving, setSaving] = useState(false);
  const [pendingOpen, setPendingOpen] = useState<{ recipe: Recipe; baseId: string | null } | null>(null);
  const lib = useLibrary();
  const base = lib.entries.find((e) => e.id === baseId) ?? null;
  const nextVersion = base ? Math.max(...lib.entries.filter((e) => e.lineageId === base.lineageId).map((e) => e.version)) + 1 : 1;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ recipe, units, baseId, dirty }));
    } catch {
      /* ignore */
    }
  }, [recipe, units, baseId, dirty]);

  const set = useCallback((p: Partial<Recipe>) => { setRecipe((r) => ({ ...r, ...p })); setDirty(true); }, []);
  const replace = useCallback((r: Recipe) => { setRecipe(r); setDirty(true); }, []);

  const loadIntoEditor = (r: Recipe, id: string | null) => {
    setRecipe(normaliseRecipe(structuredClone(r)));
    setBaseId(id);
    setDirty(id == null);
    setPendingOpen(null);
    setModal(null);
  };
  const requestOpen = (r: Recipe, id: string | null) => (dirty ? setPendingOpen({ recipe: r, baseId: id }) : loadIntoEditor(r, id));
  const openEntry = (e: LibraryEntry) => requestOpen(e.recipe, e.id);

  async function saveDraft(asNew: boolean): Promise<boolean> {
    setSaving(true);
    try {
      const entry = !asNew && base
        ? deriveEntry(base, recipe, lib.entries, { author: 'you', note: 'Edited in the app' })
        : createEntry(recipe, { author: 'you', note: base ? `Branched from ${base.name} v${base.version}` : 'First save' });
      await lib.save(entry);
      setBaseId(entry.id);
      setDirty(false);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }
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
  const pageIndex = Math.max(0, PAGES.findIndex((p) => p.id === page));
  const current = PAGES[pageIndex];
  const addReading = (sg: number) => set({ log: { ...EMPTY_LOG, ...recipe.log, readings: [...recipe.log.readings, { uid: uid(), at: new Date().toISOString(), sg }] } });
  const versionLabel = base ? `${base.name} v${base.version}${dirty ? ' + unsaved changes' : ''}` : undefined;
  const guard = (label: string, node: React.ReactNode) => <ErrorBoundary label={label} resetKey={analysis}>{node}</ErrorBoundary>;

  function pageContent() {
    const needs = (node: () => React.ReactNode) => (analysis && tracker ? node() : <p className="text-sm text-stone-500">Fix the recipe on step 1 to see this step.</p>);
    switch (page) {
      case 'plan':
        return (<>
          <BatchPanel r={recipe} set={set} replace={replace} uh={uh} />
          <div className="grid gap-4 xl:grid-cols-2">
            <FermentablesPanel r={recipe} set={set} uh={uh} a={analysis} />
            <FruitPanel r={recipe} set={set} uh={uh} a={analysis} />
          </div>
          {analysis && guard('Results', <ResultsPanel a={analysis} uh={uh} onProof={() => setModal('proof')} />)}
        </>);
      case 'yeast':
        return (<>
          <YeastPanel r={recipe} set={set} abvDry={analysis?.fg.abvDry ?? null} />
          {needs(() => guard('Nutrition', <NutrientPanel a={analysis!} />))}
        </>);
      case 'flavour':
        return (<>
          <div className="grid gap-4 xl:grid-cols-2">
            <BotanicalPanel r={recipe} set={set} uh={uh} a={analysis} kind="flowers" />
            <BotanicalPanel r={recipe} set={set} uh={uh} a={analysis} kind="spices" />
          </div>
          {needs(() => guard("Mead Maker's Brain", (
            <AdvisorPanel
              a={analysis!}
              onAddSpice={(spiceId, gpl) => set({ spices: [...recipe.spices, { uid: uid(), spiceId, grams: Number((gpl * V).toFixed(2)) }] })}
              onAddFruit={(fruitId) => set({ fruits: [...recipe.fruits, { uid: uid(), fruitId, massKg: Number((0.2 * V).toFixed(2)), stage: 'secondary' }] })}
            />
          )))}
        </>);
      case 'acid':
        return needs(() => (<>
          {guard('Acidity & pH', <AcidityPanel r={recipe} set={set} a={analysis!} />)}
          <BenchTrialCard volumeL={analysis!.sulfite.input.volumeL} uh={uh} />
        </>));
      case 'brew':
        return needs(() => (<>
          {guard('Checklist', <BrewDayPanel a={analysis!} r={recipe} set={set} uh={uh} />)}
          {guard('Batch log', <TrackerPanel r={recipe} set={set} a={analysis!} t={tracker!} now={now} />)}
          <ReadingTools onUse={addReading} />
        </>));
      case 'stabilise':
        return needs(() => (<>
          {guard('Sulfite', <SulfitePanel r={recipe} set={set} a={analysis!} uh={uh} />)}
          <SulfiteFromWeight volumeL={analysis!.sulfite.input.volumeL} uh={uh} />
        </>));
      case 'sweeten':
        return needs(() => guard('Backsweeten', <BacksweetenPanel a={analysis!} r={recipe} replace={replace} uh={uh} />));
      case 'bottle':
        return needs(() => guard('Bottle', (
          <BottlePanel a={analysis!} uh={uh} onExport={() => setModal('export')}
            onSave={() => (base && !dirty ? setModal('library') : void saveDraft(!base))}
            saveLabel={base ? (dirty ? `Save as v${nextVersion}` : `Saved as v${base.version}`) : 'Save to library'} />
        )));
    }
  }

  return (
    <>
    <div className="no-print mx-auto max-w-6xl px-4 pb-28">
      <header className="relative z-40 lg:sticky lg:top-0 -mx-4 mb-4 border-b border-stone-200 bg-stone-50/90 px-4 pb-2 pt-3 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
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
            <button className="btn-ghost" onClick={() => setModal('library')}>Recipes</button>
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
        <DraftBar base={base} nextVersion={nextVersion} dirty={dirty} saving={saving} onSaveVersion={() => saveDraft(false)} onSaveNew={() => saveDraft(true)} />
        <nav className="-mx-1 mt-2 flex gap-1 overflow-x-auto pb-1 text-xs" aria-label="Steps">
          {PAGES.map((p, i) => (
            <button key={p.id} type="button" onClick={() => go(p.id)} aria-current={page === p.id ? 'step' : undefined}
              className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-medium transition ${page === p.id ? 'bg-honey-500 text-stone-950 shadow' : 'bg-stone-200/70 text-stone-700 hover:bg-honey-200 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-honey-900/50'}`}>
              <span className="tabular opacity-70">{i + 1}</span><span aria-hidden>{p.icon}</span>{p.label}
            </button>
          ))}
        </nav>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-stone-500">Stage: <b className="text-honey-700 dark:text-honey-300">{current.phase}</b> · step {pageIndex + 1} of {PAGES.length}</span>
          <span className="flex items-center gap-1">
            <button type="button" onClick={() => setGuide((g) => !g)} aria-pressed={guide} className={`rounded-md px-2 py-0.5 font-medium ${guide ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-stone-200 text-stone-500 dark:bg-stone-800'}`}>🌱 Guide {guide ? 'on' : 'off'}</button>
            <span className="flex rounded-md bg-stone-200 p-0.5 dark:bg-stone-800" role="group" aria-label="Unit system">
              {(['metric', 'imperial'] as const).map((u) => (
                <button key={u} onClick={() => setUnits(u)} aria-pressed={units === u} className={`rounded px-2 py-0.5 font-medium capitalize ${units === u ? 'bg-white shadow dark:bg-stone-600' : 'text-stone-500'}`}>{u}</button>
              ))}
            </span>
            <button type="button" onClick={() => setTheme((t) => (t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto'))} className="rounded-md bg-stone-200 px-2 py-0.5 dark:bg-stone-800" aria-label={`Theme: ${theme}`} title={`Theme: ${theme}`}>
              {theme === 'auto' ? '🌗' : theme === 'light' ? '☀️' : '🌙'}
            </button>
          </span>
        </div>
      </header>

      {error && <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">Calculation error: {error}</div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <main className="flex min-w-0 flex-col gap-4">
          <div>
            <p className="label">{current.phase} · step {pageIndex + 1} of {PAGES.length}</p>
            <h2 className="font-display text-2xl font-semibold leading-tight">{current.icon} {current.title}</h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{current.blurb}</p>
          </div>
          {guide && <GuideBox page={current} onHide={() => setGuide(false)} />}
          {pageContent()}
          <div className="flex items-center justify-between gap-2 border-t border-stone-200 pt-3 dark:border-stone-800">
            {pageIndex > 0 ? <button type="button" className="btn-ghost border border-stone-300 dark:border-stone-700" onClick={() => go(PAGES[pageIndex - 1].id)}>← {PAGES[pageIndex - 1].label}</button> : <span />}
            {pageIndex < PAGES.length - 1 && <button type="button" className="btn-primary" onClick={() => go(PAGES[pageIndex + 1].id)}>Next: {PAGES[pageIndex + 1].label} →</button>}
          </div>
        </main>
        <aside className="hidden lg:block">
          {analysis && (
            <div className="sticky top-44 flex flex-col items-center gap-2 rounded-xl border border-stone-200 bg-white p-4 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900/60">
              <span className="text-stone-400"><GlassSvg color={analysis.color.hex} size={84} /></span>
              <p className="font-display text-lg font-semibold leading-tight">{recipe.name}</p>
              <p className="text-xs text-stone-500">{analysis.color.name}</p>
              <dl className="tabular mt-1 grid w-full grid-cols-2 gap-x-2 gap-y-1 text-left text-sm">
                <dt className="text-stone-500">OG</dt><dd className="text-right font-medium">{analysis.og.toFixed(3)}</dd>
                <dt className="text-stone-500">FG</dt><dd className="text-right font-medium">{analysis.fg.fg.toFixed(3)}</dd>
                <dt className="text-stone-500">ABV</dt><dd className="text-right font-semibold text-honey-700 dark:text-honey-300">{analysis.abv.toFixed(1)} %</dd>
                <dt className="text-stone-500">Water</dt><dd className="text-right font-medium">{uh.fmtVol(analysis.primary.waterL)}</dd>
                <dt className="text-stone-500">pH</dt><dd className="text-right font-medium">{analysis.ph.mustPh.toFixed(2)} → {analysis.ph.finishedPh.toFixed(2)}</dd>
                <dt className="text-stone-500">Yield</dt><dd className="text-right font-medium">{uh.fmtVol(analysis.occupancy.recoveredL)}</dd>
              </dl>
              <p className="mt-1 text-xs italic text-stone-500">{analysis.tastingNote}</p>
            </div>
          )}
        </aside>
      </div>

      <button onClick={() => setModal('chat')} aria-label={aiLocked ? 'Open the recipe assistant (connect your AI to unlock)' : 'Open the recipe assistant'}
        className="fixed z-30 flex items-center gap-2 rounded-full bg-stone-900 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-stone-700 dark:bg-honey-400 dark:text-stone-950 dark:hover:bg-honey-300"
        style={{ right: 'max(16px, calc(env(safe-area-inset-right, 0px) + 16px))', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
        <span aria-hidden>{aiLocked ? '🔒' : '✨'}</span> Ask AI
      </button>
      <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-stone-500">
        <span>Guidance, not gospel: verify with a hydrometer, a pH meter and bench trials.</span>
        <button className="underline" onClick={() => setModal('calc')}>ABV calculator</button>
        <button className="underline" onClick={() => setModal('sources')}>Sources & licences</button>
        {confirmReset ? (
          <span className="flex items-center gap-1">
            <button className="btn-primary" onClick={() => { loadIntoEditor(DEFAULT_RECIPE, null); setDirty(false); setConfirmReset(false); }}>Reset the editor</button>
            <button className="btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
          </span>
        ) : (
          <button className="underline" onClick={() => setConfirmReset(true)}>Reset</button>
        )}
      </footer>

      <Modal open={modal === 'check'} onClose={() => setModal(null)} title="Recipe check">
        <CheckPanel flags={flags} />
      </Modal>
      <Modal open={modal === 'library'} onClose={() => setModal(null)} title="My recipes">
        <LibraryPanel lib={lib} current={recipe} currentBaseId={baseId} onOpen={openEntry} onNew={(r) => requestOpen({ ...r, log: recipe.log }, null)} />
      </Modal>
      <Modal open={modal === 'chat'} onClose={() => setModal(null)} title="Recipe assistant">
        <ChatPanel lib={lib} draft={recipe} baseId={baseId} units={units} onOpenEntry={openEntry} />
      </Modal>
      <Modal open={pendingOpen != null} onClose={() => setPendingOpen(null)} title="Unsaved changes">
        <p className="text-sm text-stone-600 dark:text-stone-300">The recipe in the editor has changes that aren't saved. Saved versions are never affected either way.</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button className="btn-ghost" onClick={() => setPendingOpen(null)}>Cancel</button>
          <button className="btn-ghost border border-stone-300 dark:border-stone-700" onClick={() => pendingOpen && loadIntoEditor(pendingOpen.recipe, pendingOpen.baseId)}>Discard changes</button>
          <button className="btn-primary" disabled={saving} onClick={async () => { if (pendingOpen && (await saveDraft(!base))) loadIntoEditor(pendingOpen.recipe, pendingOpen.baseId); }}>
            {base ? `Save as v${nextVersion}, then open` : 'Save, then open'}
          </button>
        </div>
      </Modal>
      <Modal open={modal === 'proof'} onClose={() => setModal(null)} title="ABV: the maths and where it comes from">
        {analysis && <AbvProofView og={analysis.effectiveOg} fg={analysis.fg.fg} />}
      </Modal>
      <Modal open={modal === 'calc'} onClose={() => setModal(null)} title="ABV calculator (measured readings)">
        <AbvCalculator />
      </Modal>
      <Modal open={modal === 'export'} onClose={() => setModal(null)} title="Export to Excel / Google Sheets">
        {analysis && <ExportPanel a={analysis} versionLabel={versionLabel} />}
      </Modal>
      <Modal open={modal === 'sources'} onClose={() => setModal(null)} title="Sources & citations">
        <SourcesList />
      </Modal>
    </div>
    {analysis && <PrintSheet a={analysis} uh={uh} versionLabel={versionLabel} />}
    </>
  );
}
