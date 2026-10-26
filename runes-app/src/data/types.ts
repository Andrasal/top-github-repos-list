/** Evidence layer — see spec §1. Every claim in the UI carries one. */
export type Layer = 'attested' | 'literary' | 'modern';

export type Alphabet = 'elder' | 'younger';

/**
 * Glyph geometry in the unit frame (spec §3):
 * stem on x = 0 from y = 0 (top) to y = 1 (bottom), y points down.
 * Each stroke is a polyline [x0, y0, x1, y1, ...].
 */
export interface Glyph {
  strokes: number[][];
  /** x-positions of full-height verticals that may sit on a shared stem. */
  anchors: number[];
  /** True when the rune has no own stem and is overlaid on the shared stem. */
  overlay?: boolean;
  /** Mirroring (x → −x) would write a different rune, e.g. ᚾ ↔ ᛅ. */
  noMirror?: boolean;
  /** Flipping (y → 1−y) would write a different rune, e.g. ᛉ ↔ ᛦ. */
  noFlip?: boolean;
}

export interface PoemStanza {
  source: string;
  original?: string;
  translation: string;
}

export interface MagicalUse {
  keywords: string[];
  note: string;
  layer: Layer;
}

export interface Rune {
  id: string;
  char: string;
  alphabet: Alphabet;
  name: string;
  /** e.g. "reconstructed Proto-Germanic" or "Old Norse, attested in rune poems". */
  nameNote: string;
  position: number;
  aett: 1 | 2 | 3;
  sounds: string[];
  gloss: string;
  shortTwig?: string;
  poems: PoemStanza[];
  history: string;
  magical: MagicalUse[];
  glyph: Glyph;
}

export interface Stave {
  id: string;
  name: string;
  translation: string;
  sources: string;
  history: string;
  purpose: string;
  layer: Layer;
  /** Helm preset id when the engine can draw it; otherwise text-only. */
  helmPreset?: 'aegishjalmur' | 'vegvisir';
}

export interface Intent {
  id: string;
  label: string;
  synonyms: string[];
  elder: string[];
  younger: string[];
  rationale: string;
  layer: Layer;
}
