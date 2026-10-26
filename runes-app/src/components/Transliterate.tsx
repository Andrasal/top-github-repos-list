import { useMemo, useState } from 'react';
import { ALL_RUNES } from '../data';
import type { Alphabet } from '../data/types';
import { transliterate } from '../engine/transliterate';
import { MAX_RUNES } from '../engine/bindrune';
import { Segmented } from './Encyclopedia';

export function Transliterate({ onBind }: { onBind: (alphabet: Alphabet, runeIds: string[]) => void }) {
  const [text, setText] = useState('Sigrún');
  const [alphabet, setAlphabet] = useState<Alphabet>('younger');
  const [oAs, setOAs] = useState<'oss' | 'ur'>('oss');
  const [finalR, setFinalR] = useState(false);
  const [singleDoubles, setSingleDoubles] = useState(true);
  const out = useMemo(() => transliterate(text, alphabet, { oAs, finalR, singleDoubles }), [text, alphabet, oAs, finalR, singleDoubles]);

  // Distinct runes in order, for a name bindrune.
  const ids = [...new Set([...out.runes.replace(/᛫/g, '')])]
    .map((c) => ALL_RUNES.find((r) => r.alphabet === alphabet && r.char === c)?.id)
    .filter((x): x is string => !!x);

  return (
    <section className="translit">
      <div className="field">
        <label className="label" htmlFor="tl">
          Text (Latin letters)
        </label>
        <input id="tl" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="filters">
        <Segmented value={alphabet} onChange={setAlphabet} options={[['younger', 'Younger Futhark'], ['elder', 'Elder Futhark']]} label="Alphabet" />
        {alphabet === 'younger' && (
          <>
            <Segmented value={oAs} onChange={setOAs} options={[['oss', 'o → ᚬ'], ['ur', 'o → ᚢ']]} label="o-sound" />
            <label className="inline">
              <input type="checkbox" checked={finalR} onChange={(e) => setFinalR(e.target.checked)} /> final -R → ᛦ
            </label>
          </>
        )}
        <label className="inline">
          <input type="checkbox" checked={singleDoubles} onChange={(e) => setSingleDoubles(e.target.checked)} /> write double consonants once
        </label>
      </div>
      <p className="runes-out" lang="non-Runr">
        {out.runes || '—'}
      </p>
      <button className="primary" disabled={ids.length === 0 || ids.length > MAX_RUNES} onClick={() => onBind(alphabet, ids)}>
        Bind these {ids.length} distinct rune(s) into a bindrune
      </button>
      {ids.length > MAX_RUNES && <p className="note">More than {MAX_RUNES} distinct runes would be illegible as a bindrune.</p>}
      <table className="steps">
        <thead>
          <tr>
            <th>Letter</th>
            <th>Rune</th>
            <th>Rule</th>
          </tr>
        </thead>
        <tbody>
          {out.steps.map((s, i) => (
            <tr key={i}>
              <td>{s.from}</td>
              <td className="rc">{s.rune || '—'}</td>
              <td>{s.note ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
