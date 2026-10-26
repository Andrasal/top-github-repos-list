import { useEffect, useState } from 'react';
import { Crafting, INITIAL_CRAFT, type CraftState } from './components/Crafting';
import { Encyclopedia } from './components/Encyclopedia';
import { Transliterate } from './components/Transliterate';

type Tab = 'encyclopedia' | 'craft' | 'transliterate';
type Theme = 'light' | 'dark' | 'auto';

const read = <T,>(k: string, d: T): T => {
  try {
    return (localStorage.getItem(k) as T) ?? d;
  } catch {
    return d;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

export function App() {
  const [tab, setTab] = useState<Tab>(() => read<Tab>('runes.tab', 'encyclopedia'));
  const [theme, setTheme] = useState<Theme>(() => read<Theme>('runes.theme', 'auto'));
  const [craft, setCraft] = useState<CraftState>(INITIAL_CRAFT);

  useEffect(() => write('runes.tab', tab), [tab]);
  useEffect(() => {
    write('runes.theme', theme);
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="app">
      <header className="top">
        <h1>
          <span aria-hidden>ᚱᚢᚾᛅᚱ</span> Rúnar
        </h1>
        <nav className="tabs" aria-label="Sections">
          {(
            [
              ['encyclopedia', 'Encyclopedia'],
              ['craft', 'Crafting'],
              ['transliterate', 'Transliterate'],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button key={t} className={tab === t ? 'on' : ''} aria-current={tab === t} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </nav>
        <button
          className="theme"
          onClick={() => setTheme(theme === 'auto' ? 'dark' : theme === 'dark' ? 'light' : 'auto')}
          title="Theme"
        >
          {theme === 'auto' ? '◐' : theme === 'dark' ? '●' : '○'}
        </button>
      </header>

      <main>
        {tab === 'encyclopedia' && (
          <Encyclopedia
            onCraftRune={(r) => {
              const keep = craft.alphabet === r.alphabet ? craft.runeIds.filter((id) => id !== r.id).slice(0, 5) : [];
              setCraft({ ...craft, mode: 'bindrune', alphabet: r.alphabet, runeIds: [...keep, r.id] });
              setTab('craft');
            }}
            onCraftStave={(s) => {
              if (!s.helmPreset) return;
              setCraft({ ...craft, mode: 'helm', helmSource: s.helmPreset, count: 8 });
              setTab('craft');
            }}
          />
        )}
        {tab === 'craft' && <Crafting state={craft} setState={setCraft} />}
        {tab === 'transliterate' && (
          <Transliterate
            onBind={(alphabet, runeIds) => {
              setCraft({ ...craft, mode: 'bindrune', alphabet, runeIds });
              setTab('craft');
            }}
          />
        )}
      </main>

      <footer className="foot">
        Meanings are tagged <em>Attested</em> (inscriptions, rune poems, manuscripts), <em>Literary</em> (Eddic poems,
        sagas) or <em>Modern esoteric</em> (20th c. onward). Ægishjálmur and Vegvísir are early-modern Icelandic, not
        Viking-age.
      </footer>
    </div>
  );
}
