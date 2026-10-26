# Rúnar: runic encyclopedia and crafting engine

A React + TypeScript app for:

- **Encyclopedia.** Search the Elder Futhark (24), the Younger Futhark (16) and Icelandic staves by rune, name, sound or meaning. Every meaning is tagged *Attested*, *Literary* or *Modern esoteric*.
- **Crafting.** Turn a desired effect into runes, then draw a **bindrune** (shared-stem ligature) or a **helm** (radial stave: Ægishjálmur, Vegvísir or your own rune arms) as pure SVG.
- **The Skeptic.** A geometric auditor (checks A1–A14) inspects the exact segments that get rendered: stem continuity, attachment, connectivity, near-misses, crossing angles, overlaps, rune recoverability, radial symmetry, arm placement and clearance. It auto-corrects, and when no correction works it refuses to call the figure valid. Only verified figures can be exported.
- **Transliterate.** Latin text to runes, with the historical sound substitutions (ᚢ for u/v/w/o/ø/y, ᛏ for t/d, ᚴ for k/g, and so on).

The design contract, the historical sources and the audit rules are in [`runes_app_spec.md`](runes_app_spec.md).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 50 tests: data, bindrunes, helms, drift repair, transliteration, search
npm run build      # static site in dist/
```

## Layout

```
src/data/        rune records (elder, younger), glyph geometry, staves, intents
src/engine/      geometry · glyph variants · bindrune optimizer · helm builder
                 metrics · audit (A1–A14) · correct (auto-fix loop) · svg · search · transliterate
src/components/  Encyclopedia · Crafting (+ audit panel) · Transliterate · GlyphSvg
tests/           vitest suites
```
