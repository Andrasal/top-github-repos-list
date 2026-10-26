# Runes App — Specification & Historical Anchor

This is the single source of truth for the Runic App. Code must follow it, and any
change to rules, data or geometry must be made here first.

---

## 0. Decisions (from the initialization interview)

| Question | Decision |
|---|---|
| Tech stack | **React 18 + TypeScript + Vite**. Glyphs are rendered as **pure SVG** line segments. Tests run in Vitest. |
| Verification | **Geometric math only.** The auditor reads the same segment list the SVG is built from. It is deterministic, works offline, and can auto-correct. |
| Aesthetic | **Modern minimalist.** Charcoal `#2b2b2b` strokes on off-white `#f7f6f2`, with a dark mode. Stroke caps are `round` and joins are `round`. |
| Corpus | **Everything from day one**: Elder Futhark (24), Younger Futhark long-branch (16, plus short-twig forms as reference) and Icelandic magical staves. |

---

## 1. Historical anchoring (what we claim and what we don't)

The app separates three layers of evidence. Every entry is tagged with one of them, and the UI shows the tag.

1. **Attested.** The evidence is inscriptions, the rune poems, and medieval and early-modern manuscripts.
   - *Rune poems:* the Old Norwegian Rune Poem (*Rúnakvæði*, 13th c.), the Old Icelandic Rune Poem (*Rúnaþulur*, 15th c.) and the Anglo-Saxon Rune Poem (10th c., covering Elder/Anglo-Saxon names).
   - *Eddic poetry:* *Sigrdrífumál* st. 6–13 covers victory runes (carve on the hilt and name Týr twice), ale runes, birth-help runes, sea runes, limb runes, speech runes and mind runes. *Hávamál* st. 138–165 covers Odin's winning of the runes and the eighteen charms (*Ljóðatal*).
   - *Egils saga* ch. 72: badly carved runes on whalebone make a girl ill, and Egill re-carves them to heal her. It is evidence that a wrong carving was believed to be harmful.
   - *Inscriptional formulae:* **alu**, **laþu**, **laukaz** and **ota** on bracteates, and repeated **ᛏ** (Týr) on bracteates and spearheads.
   - *Bindrunes (bandrúnir)* are attested from the Elder period onward, mostly as ligatures that save space (e.g. Kragehul spear shaft; Gummarp/Sölvesborg forms; Viking-age ᛅᚱ-style ligatures). They were **writing**, not primarily magical sigils.
   - *Icelandic staves (galdrastafir):* *Galdrabók* (c. 1600, Iceland; now in Stockholm), the Huld manuscript (ÍB 383 4to, compiled by Geir Vigfússon, 1860) and *Galdrakver* manuscripts (Lbs. collection). Ægishjálmur and Vegvísir are early-modern (17th–19th c.), **not Viking-age**.
2. **Literary.** The *ægishjálmr* ("helm of terror") appears in *Fáfnismál* st. 16–17 and *Völsunga saga* as Fáfnir's terror-helm, which is an object or effect, not a drawn sign. The drawn stave of the same name is a later development.
3. **Modern esoteric.** This covers divinatory and "magical" keyword meanings (Guido von List 1908, the Armanen system, 20th c. Germanic neopaganism, Thorsson and Aswynn). These are **flagged as modern** and never shown as historical fact.

> The UI must never claim a modern meaning is Viking-age practice.

Rune names: Elder names are **reconstructed** Proto-Germanic (indicated with `*`). Younger names are Old Norse and attested in the rune poems.

---

## 2. Alphabets & data model

### 2.1 Elder Futhark (c. 150–800 CE), 24 runes in three ættir

| # | Rune | Name | Sound | Gloss |
|---|---|---|---|---|
| 1 | ᚠ | \*fehu | f | cattle, wealth |
| 2 | ᚢ | \*ūruz | u | aurochs |
| 3 | ᚦ | \*þurisaz | þ | giant (*þurs*) |
| 4 | ᚨ | \*ansuz | a | a god (áss) |
| 5 | ᚱ | \*raidō | r | ride, journey |
| 6 | ᚲ | \*kaunan | k | ulcer (or torch, from the AS *cēn*) |
| 7 | ᚷ | \*gebō | g | gift |
| 8 | ᚹ | \*wunjō | w | joy |
| 9 | ᚺ | \*hagalaz | h | hail |
| 10 | ᚾ | \*naudiz | n | need |
| 11 | ᛁ | \*īsaz | i | ice |
| 12 | ᛃ | \*jēra | j | year, harvest |
| 13 | ᛇ | \*ī(h)waz | ï / æ | yew |
| 14 | ᛈ | \*perþō | p | uncertain |
| 15 | ᛉ | \*algiz | z (later ʀ) | elk / protection |
| 16 | ᛊ | \*sōwilō | s | sun |
| 17 | ᛏ | \*tīwaz | t | the god Týr |
| 18 | ᛒ | \*berkanan | b | birch |
| 19 | ᛖ | \*ehwaz | e | horse |
| 20 | ᛗ | \*mannaz | m | man |
| 21 | ᛚ | \*laguz | l | water, lake |
| 22 | ᛜ | \*ingwaz | ŋ | the god Ing |
| 23 | ᛞ | \*dagaz | d | day |
| 24 | ᛟ | \*ōþalan | o | inherited land |

### 2.2 Younger Futhark (c. 800–1100 CE), 16 runes, long-branch (Danish) forms

| # | Rune | Name | Sound values (substitutions) | Short-twig |
|---|---|---|---|---|
| 1 | ᚠ | fé | f, v | ᚠ |
| 2 | ᚢ | úr | **u, v, w, o, ø, y** | ᚢ |
| 3 | ᚦ | þurs | þ, ð | ᚦ |
| 4 | ᚬ | óss | ą, o (nasal o) | ᚬ |
| 5 | ᚱ | reið | r | ᚱ |
| 6 | ᚴ | kaun | k, g, ŋ | ᚴ |
| 7 | ᚼ | hagall | h | ᚽ |
| 8 | ᚾ | nauðr | n | ᚿ |
| 9 | ᛁ | ísa | i, e, j | ᛁ |
| 10 | ᛅ | ár | a, æ, e | ᛆ |
| 11 | ᛋ | sól | s | ᛌ |
| 12 | ᛏ | Týr | t, d, nd | ᛐ |
| 13 | ᛒ | bjarkan | b, p, mb | ᛓ |
| 14 | ᛘ | maðr | m | ᛙ |
| 15 | ᛚ | lögr | l | ᛚ |
| 16 | ᛦ | ýr | ʀ (word-final -R) | ᛧ |

### 2.3 Sound substitution table (transliteration, Latin → Younger Futhark)

The 16-rune row had too few signs, so one rune covered several sounds. The transliterator uses this map (greedy, digraphs first):

```
th, þ, ð → ᚦ     ng → ᚴ (ŋ)     nd → ᛏ (optional; off by default)
a, æ → ᛅ          b, p → ᛒ          c, k, g, q → ᚴ     d, t → ᛏ
e, i, j → ᛁ       f → ᚠ             h → ᚼ              l → ᛚ
m → ᛘ             n → ᚾ             o → ᚬ (nasal / ON o) or ᚢ (option)
r → ᚱ             s, z → ᛋ          u, v, w, y, ø, ö → ᚢ
x → ᚴᛋ            final -R (ON nom. -r after consonant) → ᛦ (option)
```

The Elder map is one-to-one (with `ng → ᛜ` and `th → ᚦ`). A double consonant is written once, as on most inscriptions (an option).

### 2.4 Record shape (`src/data/types.ts`)

```ts
Rune {
  id, char, alphabet: 'elder'|'younger', name, nameNote, position, aett,
  sounds: string[], gloss,
  poems: { source, original, translation }[],   // attested
  history: string,                                 // attested / scholarly
  magical: { keywords: string[], note: string, layer: 'attested'|'literary'|'modern' }[],
  glyph: Glyph                                     // geometry, §3
}
Stave { id, name, translation, sources, history, purpose, layer, drawable, construction }
```

---

## 3. Glyph geometry (the drawing contract)

- Every rune is a list of **straight line segments** in a normalized **unit frame**:
  - the main stem lies on **x = 0**, from **y = 0 (top) to y = 1 (bottom)**;
  - branches extend to at most **|x| ≤ 0.4**;
  - y always points **down** (SVG convention).
- `anchors: number[]` lists the x-positions of the rune's full-height verticals that may sit on a central stem (ᛏ → `[0]`, ᛗ/ᛖ/ᚺ/ᛞ → `[-0.3, 0.3]`).
- Runes with no full stem (ᚷ ᛃ ᛊ ᛜ ᛟ ᚲ) are **overlay runes**. They are centered on the stem, and they must still **touch** it at least once (vertex or crossing).
- Stroke widths are set at render time, never baked into geometry. The default stroke is `0.06 × glyph height`.
- Curves are not used, because runes were carved, and straight cuts across the wood grain are the native idiom. The circles in staves are rendered as 64-gon polylines so that the auditor sees segments only.

---

## 4. Crafting engine

### 4.1 Intent → runes

`src/data/intents.ts` maps intents (protection, courage, victory, wealth, love, healing, travel, wisdom, fertility, clarity, home, luck) to candidate runes per alphabet. Each mapping has a `rationale` and a `layer`.

Example: *victory → ᛏ* is **attested** (Sigrdrífumál 6). *Protection → ᛉ* is **modern** (the elk-sedge / "protection" reading comes from 20th-c. esotericism). The intent search does fuzzy matching on synonyms ("safety" → protection).

### 4.2 Bindrune composition rules (*bandrúnir*)

1. **One shared stem.** All stemmed runes align a chosen anchor to the central stem at x = 0. The stem is drawn **once**, as a single segment (collinear strokes are merged).
2. **Variants searched per rune:** an anchor choice × mirror (x → −x) × vertical flip (y → 1 − y) × (overlay runes only) size 0.8 / 1 / 1.2 about the stem midpoint. A mirror or flip that would write a different rune is excluded: ᚾ ↔ ᛅ by mirror or flip, and ᛉ/ᛘ ↔ ᛦ by flip.
3. **Branch-sharing is good.** Identical strokes from two runes merge into one (e.g. ᚦ + ᚱ share a bowl). This is the historical ligature principle.
4. **Overlay runes** (ᚷ ᛊ ᛜ …) are centered on the stem at mid-height.
5. **Optimization:** the engine searches all variant combinations (≤ 6 runes; the search is capped at 20 000 combinations, then switches to greedy) and minimizes the clutter score:
   ```
   score = 100·(nearMisses + partialOverlaps + extraComponents)   ← hard failures dominate
           + 6·shallowCrossings + 4·nearParallel + 1·totalCrossings
           − 2·mergedStrokes + 3·asymmetry
   ```
6. **Max legible runes:** 6. Over 4 runes, the UI warns that historical bindrunes rarely combined more than 3.

### 4.3 Helm composition (radial staves)

- **Frame:** canvas center C, inner radius r₀ (hub), outer radius r₁ (arm length).
- **N arms** (4, 6, 8, 12 or 16) at angles θₖ = −90° + k·360°/N, so arm 0 points straight up.
- **Arm types:**
  - *rune arm:* a full spoke from r₀ to r₁, with the rune's strokes mapped onto the outer 85 % of it (top of the rune at the tip, so it reads from outside);
  - *terminal arm* (from staves): trident, crossbar, fork, circle, hook.
- **Hub:** a circle of radius r₀, drawn as an (N·k)-gon whose vertices include every arm angle, so the hub is exactly as symmetric as the arms.
- **Skeleton:** every arm starts with an identical spoke from r₀ to 55 % of the arm length. Terminals and runes attach beyond or along it.
- **Pattern:** the arm list is cycled across N. Full rotational symmetry needs `N mod len(pattern) = 0`.
- **Presets:** Ægishjálmur (8 identical trident-and-crossbar arms, center ring) and Vegvísir (8 differing arms, which by design has only skeleton symmetry; this is historically accurate).

---

## 5. Audit engine — "The Skeptic"

The auditor reads the final segment list (the same data the SVG is built from) and runs these checks. Each check returns `pass | warn | fail`, a message, and the offending segments for highlighting.

| ID | Check | Applies to | Rule |
|---|---|---|---|
| A1 | Stem continuity | bindrune | After merging, exactly **one** stem segment covers y ∈ [0,1] at x = 0 (tolerance ε = 0.004). |
| A2 | Branch attachment | bindrune | Every stemmed rune's branch that started on its anchor must have an endpoint on the stem (dist < ε). Overlay runes must touch the stem. |
| A3 | Connectivity | both | All strokes form **one connected component** (union-find over endpoint contact and segment intersections). Floating fragments fail. |
| A4 | Near-miss | both | Endpoint-to-segment gaps in (ε, 0.035] fail as "almost touching", which is illegible when carved. |
| A5 | Shallow crossings | both | Two strokes crossing at under 15° warn (they look like a smear). |
| A6 | Near-parallel crowding | both | Parallel strokes (angle < 6°) with overlapping projections and a gap under 0.05 warn. |
| A7 | Partial collinear overlap | both | Two collinear strokes that overlap but are not identical fail, because they read as one long stroke and change the rune. |
| A8 | Rune recoverability | bindrune | Each input rune's transformed strokes must all be present in the composite (as a sub-segment of a merged stroke). |
| A9 | Radial symmetry | helm | Rotate by 360°/N about C; every segment must map onto a segment (endpoint match < 0.001). Reports the actual order *k*. With p distinct arm types the best possible order is N/p, so a "full" helm fails if p ∤ N or k < N/p. A "skeleton" helm (Vegvísir) requires N-fold symmetry of hub + spokes only. |
| A10 | Arm angular accuracy | helm | Each arm's spoke angle must equal θₖ within 0.05°, and its length r₁ − r₀ within ε. |
| A11 | Bounds & margin | both | All points lie inside the viewBox with a margin ≥ 6 %. |
| A12 | Rune count / clutter | bindrune | More than 4 runes warns; more than 6 is refused. |
| A14 | Arm clearance | helm | Strokes of different arms must not touch or cross (hub excluded). Auto-fix: narrow ornaments (×0.9 steps, down to 35 %), then widen the hub. |
| A13 | Semantic conflict | both | Pairs flagged in modern practice as working against each other (e.g. ᛁ stasis + ᚱ/ᛖ movement; ᚺ/ᚼ disruption + ᚹ joy; ᚾ constraint + ᚠ/ᛃ flow of wealth) only **warn**, and are labelled "modern convention". |

### 5.1 Auto-correction loop

```
draw → audit → if any FAIL with a known fixer:
          snap endpoints within 0.035 onto nearest stem/segment (A2, A4)
          re-merge collinear strokes; split partial overlaps → union (A1, A7)
          helm: rebuild every arm from arm 0 by exact rotation; re-snap angles (A9, A10)
          rescale/recentre into viewBox (A11)
       → re-audit (max 3 passes) → present result + correction log
```

If fails remain after 3 passes, the result is **not** presented as valid. The UI shows the failing checks in red and offers the next-best layout from the optimizer.

---

### 5.2 Additional rules learned in the Skeptic pass (Step 4)

These came out of auditing every rune, all 396 same-alphabet pairs, every intent set and helms at N ∈ {4, 6, 8, 12, 16}:

| Finding | Rule now in force |
|---|---|
| Branches leaving the stem on opposite sides were flagged as near-misses. | Endpoints on the stem (bindrune) or hub (helm) are deliberate junctions and are exempt from A4. |
| Ring polygons and zigzags flagged their own edges (A4, A5). | Edges of one polyline are never compared with each other (`Seg.poly`). |
| Splitting a spoke at the skeleton point created a fake endpoint. | A point with a collinear continuation is not an end. |
| ᛉ crossing ᛈ's arm 0.03 from its corner was exempted as a "corner". | Only end-to-end joins near p are exempt. Crossings near a corner remain near-misses. |
| Alternating arm patterns were held to N-fold symmetry. | With p distinct arm types, the required order is N/p (A9). |
| Rune arms reached into the hub ring and grazed it. | Rune arms start at 15 % of the arm length on a full hub-to-tip spoke. |
| Helm narrowing stopped when arms merely stopped touching. | Narrow until A14 **and** A4 pass, so there's real clearance. |
| The optimizer could pick a layout with gaps over a clean one. | Hard failures weigh 100 in the score (§4.2). |
| Failed repairs showed distorted, snapped runes. | A snap is kept only if the whole audit passes. Otherwise the clean, invalid layout is shown. |
| Some sets have no clean layout as drawn (e.g. ᚢᛏᛊᛒ). | Compare the top 24 layouts, each as drawn and with hair-line gaps snapped into joints. Keep the one with the fewest soft warnings; A8 confirms that every rune is still readable. |
| Vegvísir ring terminals were about 10 px across with a 7 px stroke. | Ring radius was raised to 0.06 of the arm. |

**Known genuine conflicts** (no layout passes; the app says so rather than faking it): ᛇ+ᛏ and ᛇ+ᛒ. ᛇ's hooks compete with ᛏ's arms and ᛒ's bowls for the same corner of the stem in every orientation.

## 6. Rendering rules

- SVG `viewBox="0 0 400 400"`. Bindrunes fill a 260-tall stem centered in the box. Helms use r₁ = 170.
- `stroke="currentColor"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill="none"`.
- Coordinates are rounded to 0.01 when serializing. Export as standalone SVG with an embedded `<title>`.
- Audit highlights draw over the glyph in an accent color, with dashed strokes for warnings.

## 7. Search

The index covers rune char, name (accent-insensitive), sound values, gloss, keywords, poem text and history. Ranking:
exact char > exact name > sound > keyword > gloss/poem text. Filters are alphabet and evidence layer.

## 8. Project layout

```
runes-app/
  runes_app_spec.md        ← this file
  src/data/                runes (elder, younger), staves, intents, types
  src/engine/              geometry, glyph transforms, bindrune, helm, audit, transliterate, search, svg
  src/components/          Encyclopedia, Crafting, AuditPanel, GlyphSvg
  tests/                   vitest: geometry, audit, bindrune, helm, transliteration, search
```
