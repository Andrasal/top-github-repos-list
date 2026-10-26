import { useMemo, useState } from 'react';
import { ELDER, YOUNGER, getRune } from '../data';
import type { Alphabet } from '../data/types';
import type { AuditReport } from '../engine/audit';
import { MAX_RUNES, composeBindrune, withSegments } from '../engine/bindrune';
import { perturb, verifyBindrune, verifyHelm } from '../engine/correct';
import { ALLOWED_COUNTS, PRESETS, buildHelm, runeHelmSpec } from '../engine/helm';
import { findIntent } from '../engine/search';
import { toSvgDocument } from '../engine/svg';
import { LayerBadge, RuneGlyph, Segmented } from './Encyclopedia';
import { GlyphSvg } from './GlyphSvg';

export type Mode = 'bindrune' | 'helm';
export type HelmSource = 'runes' | 'aegishjalmur' | 'vegvisir';

export interface CraftState {
  mode: Mode;
  alphabet: Alphabet;
  runeIds: string[];
  helmSource: HelmSource;
  count: number;
}

export const INITIAL_CRAFT: CraftState = {
  mode: 'bindrune',
  alphabet: 'younger',
  runeIds: ['younger-tyr', 'younger-sol'],
  helmSource: 'aegishjalmur',
  count: 8,
};

const SUGGESTIONS = ['protection', 'courage', 'victory', 'wealth', 'healing', 'travel', 'wisdom', 'love', 'luck'];

export function Crafting({ state, setState }: { state: CraftState; setState: (s: CraftState) => void }) {
  const [effect, setEffect] = useState('');
  const [stress, setStress] = useState(0); // 0 = off; otherwise a seed
  const [showBefore, setShowBefore] = useState(false);
  const [showIssues, setShowIssues] = useState(true);
  const set = (p: Partial<CraftState>) => setState({ ...state, ...p });

  const intent = findIntent(effect);
  const pool = state.alphabet === 'elder' ? ELDER : YOUNGER;

  const result = useMemo(() => {
    try {
      if (state.mode === 'bindrune') {
        if (state.runeIds.length === 0) return null;
        const ideal = composeBindrune(state.runeIds);
        const input = stress ? withSegments(ideal, perturb(ideal.segments, 0.012, stress)) : ideal;
        return { input, verified: verifyBindrune(input), extra: `${ideal.strategy} search over ${ideal.searched} layout(s)` };
      }
      const spec =
        state.helmSource === 'runes'
          ? state.runeIds.length
            ? runeHelmSpec(state.runeIds, state.count)
            : null
          : { ...PRESETS[state.helmSource], count: state.helmSource === 'vegvisir' ? 8 : state.count };
      if (!spec) return null;
      const ideal = buildHelm(spec);
      const input = stress ? { ...ideal, segments: perturb(ideal.segments, 0.008, stress) } : ideal;
      return { input, verified: verifyHelm(input), extra: '' };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [state, stress]);

  const applyIntent = () => {
    if (!intent) return;
    const ids = (state.alphabet === 'elder' ? intent.elder : intent.younger).slice(0, 3);
    set({ runeIds: ids, ...(state.mode === 'helm' ? { helmSource: 'runes' as const } : {}) });
    setStress(0);
  };

  const toggleRune = (id: string) => {
    const has = state.runeIds.includes(id);
    if (!has && state.runeIds.length >= MAX_RUNES) return;
    set({ runeIds: has ? state.runeIds.filter((x) => x !== id) : [...state.runeIds, id] });
    setStress(0);
  };

  const title =
    state.mode === 'helm' && state.helmSource !== 'runes'
      ? state.helmSource === 'aegishjalmur'
        ? 'Ægishjálmur'
        : 'Vegvísir'
      : state.runeIds.map((id) => getRune(id).char).join('') || 'Bindrune';

  const download = () => {
    if (!result || 'error' in result) return;
    const svg = toSvgDocument(result.verified.design.segments, state.mode === 'bindrune' ? 'bindrune' : 'helm', title);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${title}.svg` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="crafting">
      <div className="controls">
        <Segmented
          value={state.mode}
          onChange={(mode) => {
            set({ mode });
            setStress(0);
          }}
          options={[['bindrune', 'Bindrune'], ['helm', 'Helm']]}
          label="Figure type"
        />

        {state.mode === 'helm' && (
          <div className="field">
            <span className="label">Helm</span>
            <Segmented
              value={state.helmSource}
              onChange={(helmSource) => {
                set({ helmSource });
                setStress(0);
              }}
              options={[['aegishjalmur', 'Ægishjálmur'], ['vegvisir', 'Vegvísir'], ['runes', 'Rune arms']]}
              label="Helm source"
            />
            {state.helmSource !== 'vegvisir' && (
              <label className="inline">
                Arms
                <select value={state.count} onChange={(e) => set({ count: +e.target.value })}>
                  {ALLOWED_COUNTS.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {(state.mode === 'bindrune' || state.helmSource === 'runes') && (
          <>
            <div className="field">
              <span className="label">Desired effect</span>
              <form
                className="effect"
                onSubmit={(e) => {
                  e.preventDefault();
                  applyIntent();
                }}
              >
                <input
                  value={effect}
                  onChange={(e) => setEffect(e.target.value)}
                  placeholder="e.g. protection, courage, safe travel"
                  aria-label="Desired effect"
                />
                <button type="submit" disabled={!intent}>
                  Choose runes
                </button>
              </form>
              <div className="chips">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" onClick={() => setEffect(s)}>
                    {s}
                  </button>
                ))}
              </div>
              {effect && (
                <p className="intent-note">
                  {intent ? (
                    <>
                      <strong>{intent.label}</strong> → {(state.alphabet === 'elder' ? intent.elder : intent.younger).map((id) => getRune(id).char).join(' ')}{' '}
                      <LayerBadge layer={intent.layer} /> {intent.rationale}
                    </>
                  ) : (
                    'No matching effect. Try one of the suggestions.'
                  )}
                </p>
              )}
            </div>

            <div className="field">
              <span className="label">
                Runes ({state.runeIds.length}/{MAX_RUNES})
              </span>
              <Segmented
                value={state.alphabet}
                onChange={(alphabet) => set({ alphabet, runeIds: [] })}
                options={[['younger', 'Younger Futhark'], ['elder', 'Elder Futhark']]}
                label="Alphabet"
              />
              <div className="picker">
                {pool.map((r) => (
                  <button
                    key={r.id}
                    className={`pick ${state.runeIds.includes(r.id) ? 'on' : ''}`}
                    onClick={() => toggleRune(r.id)}
                    title={`${r.name} /${r.sounds.join(', ')}/`}
                    aria-pressed={state.runeIds.includes(r.id)}
                  >
                    <RuneGlyph rune={r} size={30} />
                    <small>{r.name}</small>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="stage">
        {!result && <p className="hint">Pick at least one rune.</p>}
        {result && 'error' in result && <p className="error">{result.error}</p>}
        {result && !('error' in result) && (
          <>
            {showBefore ? (
              <div className={`verdict ${result.verified.initial.ok ? 'ok' : 'bad'}`}>
                Before correction:{' '}
                {result.verified.initial.ok
                  ? 'already passed'
                  : `${result.verified.initial.checks.filter((c) => c.status === 'fail').length} failing check(s)`}
              </div>
            ) : (
              <div className={`verdict ${result.verified.valid ? 'ok' : 'bad'}`}>
                {result.verified.valid
                  ? `✓ Verified by the Skeptic${result.verified.passes ? ` after ${result.verified.passes} correction pass(es)` : ''}`
                  : '✗ Not valid: see the failing checks'}
              </div>
            )}
            <div className="canvas">
              <GlyphSvg
                segments={showBefore ? result.input.segments : result.verified.design.segments}
                kind={state.mode === 'bindrune' ? 'bindrune' : 'helm'}
                checks={(showBefore ? result.verified.initial : result.verified.report).checks}
                showIssues={showIssues}
                title={title}
              />
            </div>
            <div className="stage-actions">
              <button onClick={download} disabled={!result.verified.valid} title={result.verified.valid ? '' : 'Only verified figures can be exported'}>
                Export SVG
              </button>
              <button onClick={() => setStress(stress ? 0 : Math.floor(Math.random() * 1e6) + 1)}>
                {stress ? 'Clear stress test' : 'Stress test: add drift'}
              </button>
              <label className="inline">
                <input type="checkbox" checked={showIssues} onChange={(e) => setShowIssues(e.target.checked)} /> Highlight issues
              </label>
              <label className="inline">
                <input type="checkbox" checked={showBefore} onChange={(e) => setShowBefore(e.target.checked)} /> Show before correction
              </label>
            </div>
            <AuditPanel report={showBefore ? result.verified.initial : result.verified.report} log={result.verified.log} extra={result.extra} order={result.verified.report.symmetryOrder} />
          </>
        )}
      </div>
    </section>
  );
}

const ICON = { pass: '✓', warn: '!', fail: '✗' } as const;

function AuditPanel({ report, log, extra, order }: { report: AuditReport; log: string[]; extra: string; order?: number }) {
  return (
    <div className="audit">
      <h3>The Skeptic: geometry audit</h3>
      <ul className="checks">
        {report.checks.map((c) => (
          <li key={c.id} className={`check ${c.status}`}>
            <span className="icon" aria-label={c.status}>
              {ICON[c.status]}
            </span>
            <span className="cid">{c.id}</span>
            <span>
              <strong>{c.title}.</strong> {c.message}
            </span>
          </li>
        ))}
      </ul>
      <details open={log.length > 1}>
        <summary>Correction log{order ? ` · symmetry order ${order}` : ''}</summary>
        <ol className="log">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
          {extra && <li className="muted">Layout: {extra}.</li>}
        </ol>
      </details>
    </div>
  );
}
