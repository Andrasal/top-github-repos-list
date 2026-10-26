import { getRune } from '../data';
import { mergeCollinear, seg, type MergeGroup, type Seg } from './geometry';
import { placeRune, variants, type Placement } from './glyph';
import { clutterScore, measure, type Metrics } from './metrics';

export const MAX_RUNES = 6;
export const WARN_RUNES = 4;
const BRUTE_FORCE_LIMIT = 20000;

export interface BindruneDesign {
  kind: 'bindrune';
  runeIds: string[];
  placements: Placement[];
  /** Ideal strokes per rune instance (for the recoverability check A8). */
  expected: Seg[][];
  /** Final, merged strokes; this is exactly what gets rendered. */
  segments: Seg[];
  groups: MergeGroup[];
  metrics: Metrics;
  score: number;
  searched: number;
  strategy: 'brute-force' | 'greedy';
}

/** The shared stem, drawn once (spec §4.2 rule 1). */
const STEM = (): Seg => seg(0, 0, 0, 1, [-1], 'stem');

/** Builds the composite for a fixed set of placements. */
export function assemble(placements: Placement[]): Omit<BindruneDesign, 'searched' | 'strategy'> {
  const expected = placements.map((p, i) => placeRune(getRune(p.runeId), p, i));
  const raw = [STEM(), ...expected.flat()];
  const groups = mergeCollinear(raw);
  const segments = groups.map((g) => g.merged);
  const metrics = measure(segments, groups);
  return {
    kind: 'bindrune',
    runeIds: placements.map((p) => p.runeId),
    placements,
    expected,
    segments,
    groups,
    metrics,
    score: clutterScore(metrics, segments),
  };
}

/**
 * Finds the least cluttered arrangement of the given runes on one stem.
 * Exhaustive when the variant space is small, otherwise greedy placement
 * followed by coordinate-descent passes (spec §4.2 rule 5).
 */
export function composeBindrune(runeIds: string[]): BindruneDesign {
  if (runeIds.length === 0) throw new Error('A bindrune needs at least one rune.');
  if (runeIds.length > MAX_RUNES) throw new Error(`A bindrune of more than ${MAX_RUNES} runes is refused as illegible (A12).`);

  const options = runeIds.map((id) => variants(getRune(id)));
  const space = options.reduce((n, o) => n * o.length, 1);

  if (space <= BRUTE_FORCE_LIMIT) {
    let best: ReturnType<typeof assemble> | null = null;
    const idx = new Array(options.length).fill(0);
    for (let n = 0; n < space; n++) {
      const d = assemble(idx.map((k, i) => options[i][k]));
      if (!best || d.score < best.score - 1e-9) best = d;
      for (let i = 0; i < idx.length; i++) {
        if (++idx[i] < options[i].length) break;
        idx[i] = 0;
      }
    }
    return { ...best!, searched: space, strategy: 'brute-force' };
  }

  // Greedy: place one rune at a time, keeping the best partial composite.
  let searched = 0;
  const chosen: Placement[] = [];
  for (let i = 0; i < options.length; i++) {
    let bestP = options[i][0];
    let bestScore = Infinity;
    for (const p of options[i]) {
      const s = assemble([...chosen, p]).score;
      searched++;
      if (s < bestScore) [bestScore, bestP] = [s, p];
    }
    chosen.push(bestP);
  }
  // Coordinate descent until no single change improves the score.
  let current = assemble(chosen);
  for (let pass = 0; pass < 4; pass++) {
    let improved = false;
    for (let i = 0; i < options.length; i++) {
      for (const p of options[i]) {
        const trial = [...current.placements];
        trial[i] = p;
        const d = assemble(trial);
        searched++;
        if (d.score < current.score - 1e-9) {
          current = d;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return { ...current, searched, strategy: 'greedy' };
}

/** Rebuilds a design from (possibly corrected) segments, keeping provenance. */
export function withSegments(d: BindruneDesign, segments: Seg[]): BindruneDesign {
  const groups = mergeCollinear(segments);
  const merged = groups.map((g) => g.merged);
  const metrics = measure(merged, groups);
  return { ...d, segments: merged, groups, metrics, score: clutterScore(metrics, merged) };
}
