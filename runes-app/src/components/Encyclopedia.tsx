import { useMemo, useState } from 'react';
import type { Alphabet, Layer, Rune, Stave } from '../data/types';
import { placeRune } from '../engine/glyph';
import { search } from '../engine/search';
import { GlyphSvg } from './GlyphSvg';

export const LAYER_LABEL: Record<Layer, string> = {
  attested: 'Attested',
  literary: 'Literary',
  modern: 'Modern esoteric',
};

export function LayerBadge({ layer }: { layer: Layer }) {
  return <span className={`badge layer-${layer}`}>{LAYER_LABEL[layer]}</span>;
}

export function RuneGlyph({ rune, size = 56 }: { rune: Rune; size?: number }) {
  const segs = placeRune(rune, { runeId: rune.id, anchor: 0, mirror: false, flip: false }, 0);
  return <GlyphSvg segments={segs} kind="bindrune" title={`${rune.name} ${rune.char}`} size={size} />;
}

interface Props {
  onCraftRune: (rune: Rune) => void;
  onCraftStave: (stave: Stave) => void;
}

export function Encyclopedia({ onCraftRune, onCraftStave }: Props) {
  const [q, setQ] = useState('');
  const [alphabet, setAlphabet] = useState<Alphabet | 'all'>('all');
  const [layer, setLayer] = useState<Layer | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const hits = useMemo(() => search(q, { alphabet, layer }), [q, alphabet, layer]);
  const selected = hits.find((h) => h.item.id === open) ?? null;

  return (
    <section className="encyclopedia">
      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search a rune, name, sound or meaning: ᛏ, Týr, /u/, protection…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search runes"
        />
        <div className="filters">
          <Segmented
            value={alphabet}
            onChange={setAlphabet}
            options={[['all', 'All'], ['elder', 'Elder'], ['younger', 'Younger']]}
            label="Alphabet"
          />
          <Segmented
            value={layer}
            onChange={setLayer}
            options={[['all', 'Any evidence'], ['attested', 'Attested'], ['literary', 'Literary'], ['modern', 'Modern']]}
            label="Evidence"
          />
        </div>
      </div>

      <div className="enc-body">
        <ul className="results" aria-label="Results">
          {hits.length === 0 && <li className="empty">Nothing found. Try a sound like “u”, a name like “sól”, or an effect like “victory”.</li>}
          {hits.map((h) => (
            <li key={h.item.id}>
              <button className={`card ${open === h.item.id ? 'active' : ''}`} onClick={() => setOpen(h.item.id)}>
                {h.type === 'rune' ? (
                  <>
                    <RuneGlyph rune={h.item} size={44} />
                    <span className="card-text">
                      <strong>{h.item.name}</strong>
                      <small>
                        {h.item.alphabet === 'elder' ? 'Elder' : 'Younger'} · /{h.item.sounds.join(', ')}/ · {h.item.gloss}
                      </small>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="stave-mark" aria-hidden>✳</span>
                    <span className="card-text">
                      <strong>{h.item.name}</strong>
                      <small>Icelandic stave · {h.item.translation}</small>
                    </span>
                  </>
                )}
                {h.why && <span className="why">{h.why}</span>}
              </button>
            </li>
          ))}
        </ul>

        <article className="detail" aria-live="polite">
          {!selected && <p className="hint">Select a rune or stave to read its poems, history and meanings.</p>}
          {selected?.type === 'rune' && <RuneDetail rune={selected.item} onCraft={() => onCraftRune(selected.item)} />}
          {selected?.type === 'stave' && <StaveDetail stave={selected.item} onCraft={() => onCraftStave(selected.item)} />}
        </article>
      </div>
    </section>
  );
}

function RuneDetail({ rune, onCraft }: { rune: Rune; onCraft: () => void }) {
  return (
    <>
      <header className="detail-head">
        <RuneGlyph rune={rune} size={96} />
        <div>
          <h2>
            {rune.name} <span className="char">{rune.char}</span>
          </h2>
          <p className="meta">
            {rune.alphabet === 'elder' ? 'Elder Futhark' : 'Younger Futhark'} · #{rune.position} · ætt {rune.aett}
            {rune.shortTwig && rune.shortTwig !== rune.char && <> · short-twig {rune.shortTwig}</>}
          </p>
          <p className="meta">
            Sounds <strong>/{rune.sounds.join(', ')}/</strong> · {rune.gloss}
          </p>
          <p className="note">{rune.nameNote}</p>
        </div>
      </header>
      <button className="primary" onClick={onCraft}>
        Use in a bindrune
      </button>

      <h3>History</h3>
      <p>{rune.history}</p>

      {rune.poems.length > 0 && (
        <>
          <h3>Rune poems</h3>
          {rune.poems.map((p) => (
            <blockquote key={p.source}>
              {p.original && <p className="original">{p.original}</p>}
              <p>{p.translation}</p>
              <cite>{p.source}</cite>
            </blockquote>
          ))}
        </>
      )}

      <h3>Magical &amp; ritual use</h3>
      <ul className="uses">
        {rune.magical.map((m, i) => (
          <li key={i}>
            <LayerBadge layer={m.layer} />
            <div>
              <div className="kw">{m.keywords.join(' · ')}</div>
              <p>{m.note}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function StaveDetail({ stave, onCraft }: { stave: Stave; onCraft: () => void }) {
  return (
    <>
      <header className="detail-head">
        <div>
          <h2>{stave.name}</h2>
          <p className="meta">{stave.translation}</p>
          <LayerBadge layer={stave.layer} />
        </div>
      </header>
      {stave.helmPreset ? (
        <button className="primary" onClick={onCraft}>
          Draw this helm
        </button>
      ) : (
        <p className="note">
          Not drawn: there is no reliable geometric reconstruction encoded yet. Consult the manuscripts rather than a
          guessed drawing.
        </p>
      )}
      <h3>Purpose</h3>
      <p>{stave.purpose}</p>
      <h3>History</h3>
      <p>{stave.history}</p>
      <h3>Sources</h3>
      <p>{stave.sources}</p>
    </>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}
