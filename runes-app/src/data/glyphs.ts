import type { Glyph } from './types';

/** Full-height stem on x = 0. */
const S = [0, 0, 0, 1];

/**
 * Shape library in the unit frame (spec §3). Shapes are shared where the
 * Elder and Younger forms coincide (ᚠ ᚢ ᚦ ᚱ ᚾ ᛁ ᛏ ᛒ ᛚ).
 * Verified against the Unicode Runic block reference glyphs.
 */
export const GLYPHS: Record<string, Glyph> = {
  f: { strokes: [S, [0, 0.25, 0.38, 0.05], [0, 0.5, 0.38, 0.3]], anchors: [0] },
  u: { strokes: [S, [0, 0, 0.38, 0.3, 0.38, 1]], anchors: [0] },
  th: { strokes: [S, [0, 0.28, 0.32, 0.5, 0, 0.72]], anchors: [0] },
  // Elder ᚨ: two branches descending to the right.
  a_elder: { strokes: [S, [0, 0, 0.36, 0.22], [0, 0.22, 0.36, 0.44]], anchors: [0] },
  // Younger ᚬ: the two branches pass through the stem.
  oss: { strokes: [S, [-0.3, 0.08, 0.3, 0.32], [-0.3, 0.3, 0.3, 0.54]], anchors: [0] },
  r: { strokes: [S, [0, 0, 0.34, 0.22, 0, 0.44, 0.38, 1]], anchors: [0] },
  // Elder ᚲ: half-height angle; its vertex sits on the stem.
  k_elder: { strokes: [[0.32, 0.3, 0, 0.5, 0.32, 0.7]], anchors: [0], overlay: true },
  // Younger ᚴ: a single branch rising to the right.
  kaun: { strokes: [S, [0, 0.35, 0.36, 0.05]], anchors: [0] },
  g: {
    strokes: [[-0.34, 0.15, 0.34, 0.85], [0.34, 0.15, -0.34, 0.85]],
    anchors: [0],
    overlay: true,
  },
  w: { strokes: [S, [0, 0, 0.32, 0.2, 0, 0.4]], anchors: [0] },
  // Elder ᚺ: two staves, one descending crossbar.
  h_elder: {
    strokes: [[-0.3, 0, -0.3, 1], [0.3, 0, 0.3, 1], [-0.3, 0.35, 0.3, 0.65]],
    anchors: [-0.3, 0.3],
  },
  // Younger ᚼ: stem with an X.
  hagall: { strokes: [S, [-0.3, 0.3, 0.3, 0.7], [0.3, 0.3, -0.3, 0.7]], anchors: [0] },
  // ᚾ: bar descends left→right. Mirror/flip would give ᛅ.
  n: { strokes: [S, [-0.25, 0.35, 0.25, 0.6]], anchors: [0], noMirror: true, noFlip: true },
  i: { strokes: [S], anchors: [0] },
  // ᛃ: two interlocking angles, ends on the stem line.
  j: {
    strokes: [[0, 0.15, -0.28, 0.4, 0, 0.65], [0, 0.35, 0.28, 0.6, 0, 0.85]],
    anchors: [0],
    overlay: true,
  },
  // ᛅ: bar rises left→right. Mirror/flip would give ᚾ.
  ar: { strokes: [S, [-0.25, 0.6, 0.25, 0.35]], anchors: [0], noMirror: true, noFlip: true },
  ei: { strokes: [S, [0, 0, 0.3, 0.2], [0, 1, -0.3, 0.8]], anchors: [0] },
  p: { strokes: [S, [0, 0, 0.24, 0.2, 0.36, 0.04], [0, 1, 0.24, 0.8, 0.36, 0.96]], anchors: [0] },
  // ᛉ / ᛘ: branches rising. Flip would give ᛦ.
  z: { strokes: [S, [0, 0.4, -0.34, 0.06], [0, 0.4, 0.34, 0.06]], anchors: [0], noFlip: true },
  madr: { strokes: [S, [0, 0.36, -0.32, 0.04], [0, 0.36, 0.32, 0.04]], anchors: [0], noFlip: true },
  // ᛦ: branches falling. Flip would give ᛉ/ᛘ.
  yr: { strokes: [S, [0, 0.6, -0.34, 0.94], [0, 0.6, 0.34, 0.94]], anchors: [0], noFlip: true },
  // Elder ᛊ: zigzag crossing the stem line.
  s_elder: { strokes: [[0.16, 0.04, -0.2, 0.38, 0.2, 0.62, -0.16, 0.96]], anchors: [0], overlay: true },
  // Younger ᛋ: stepped stave; either half can ride the stem.
  sol: { strokes: [[-0.16, 0, -0.16, 0.42, 0.16, 0.58, 0.16, 1]], anchors: [-0.16, 0.16] },
  t: { strokes: [S, [0, 0, -0.34, 0.26], [0, 0, 0.34, 0.26]], anchors: [0] },
  b: { strokes: [S, [0, 0, 0.32, 0.25, 0, 0.5, 0.32, 0.75, 0, 1]], anchors: [0] },
  e: {
    strokes: [[-0.3, 0, -0.3, 1], [0.3, 0, 0.3, 1], [-0.3, 0, 0, 0.28, 0.3, 0]],
    anchors: [-0.3, 0.3],
  },
  m_elder: {
    strokes: [[-0.3, 0, -0.3, 1], [0.3, 0, 0.3, 1], [-0.3, 0, 0.3, 0.4], [0.3, 0, -0.3, 0.4]],
    anchors: [-0.3, 0.3],
  },
  l: { strokes: [S, [0, 0, 0.34, 0.26]], anchors: [0] },
  ng: { strokes: [[0, 0.28, 0.24, 0.5, 0, 0.72, -0.24, 0.5, 0, 0.28]], anchors: [0], overlay: true },
  d: {
    strokes: [[-0.3, 0, -0.3, 1], [0.3, 0, 0.3, 1], [-0.3, 0, 0.3, 1], [0.3, 0, -0.3, 1]],
    anchors: [-0.3, 0, 0.3],
  },
  o_elder: {
    strokes: [[0, 0, 0.26, 0.3, -0.3, 1], [0, 0, -0.26, 0.3, 0.3, 1]],
    anchors: [0],
    overlay: true,
  },
};
