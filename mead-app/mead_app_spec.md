# Mead App — Master Specification (`mead_app_spec.md`)

> **Status:** Source of truth. Any change to math, constants, data shape or rules
> MUST be made here first, then in code. Every constant in code carries a
> `// SPEC §x.y` tag pointing back to this file, and a `source` id from the
> citation registry (§9).

---

## 0. Decisions (from the initialization interview)

| Question | Decision |
|---|---|
| Tech stack | **React 18 + TypeScript + Vite**. Pure-TS math core (`src/lib`), unit-tested with **Vitest**. |
| Units | **Metric default** (L, kg, g, g/L) with an **Imperial toggle** (US gal, lb, oz, oz/gal). All math runs in SI internally; conversion happens only at the UI boundary. |
| Data | **Local JSON database** (`src/data/*.json`), versioned, every entry carrying a `source` reference. No network calls. |
| UI framework | **Tailwind CSS v3**. |

---

## 1. Architecture

```
mead-app/
├── mead_app_spec.md          ← this file (source of truth)
├── src/
│   ├── lib/                  ← PURE functions, no React, no DOM, 100% testable
│   │   ├── constants.ts      ← physical/enological constants (§2)
│   │   ├── sources.ts        ← citation registry (§9)
│   │   ├── units.ts          ← SI ⇄ Imperial conversions (§2.3)
│   │   ├── gravity.ts        ← Plato/Brix ⇄ SG, blending (§3)
│   │   ├── abv.ts            ← Alternative ABV equation (§4)
│   │   ├── must.ts           ← mass-balance must solver, fruit displacement (§5)
│   │   ├── fermentation.ts   ← FG prediction, sweetness, BJCP strength, sugar breaks (§6)
│   │   ├── nutrients.ts      ← YAN requirement + SNA protocols (§7)
│   │   ├── flavor.ts         ← Flavor Intelligence Engine (§8)
│   │   ├── recipe.ts         ← orchestrator: Recipe → full Analysis
│   │   └── __tests__/        ← Vitest suites
│   ├── data/                 ← honeys, fruits, spices, yeasts, pairings (JSON)
│   ├── components/           ← React UI
│   └── App.tsx
```

**Data flow:** `Recipe` (user state, SI units) → `analyzeRecipe()` → `Analysis`
(must, gravity, ABV, YAN, schedule, advisories, citations) → UI. The UI never
does math.

---

## 2. Constants

### 2.1 Physical constants

| Symbol | Value | Meaning | Source |
|---|---|---|---|
| `RHO_WATER_20C` | 0.99820 kg/L | Density of water at 20 °C; SG is referenced to this | `crc-water` |
| `RHO_ETHANOL` | 0.794 g/mL | Density of ethanol at 20 °C (used in Alt ABV) | `hall-1995` |
| `RHO_HONEY_DEFAULT` | **1.42 kg/L** (range 1.38–1.45) | Honey density at ~17–18 % moisture | `nhb-honey`, `white-1975` |
| `HONEY_SOLIDS_DEFAULT` | 0.82 (82 °Brix) | Dissolved solids fraction of honey (moisture ≈ 17–18 %) | `nhb-honey`, `white-1975` |
| `RHO_SUCROSE_SOLID` | 1.587 kg/L | Crystalline sucrose (only for dry-volume display) | `crc-sucrose` |
| `RHO_FRUIT_WHOLE` | 1.05 kg/L | Whole fruit bulk density for displacement (berries/stone fruit ~1.0–1.1) | `practice` |
| `RHO_FRUIT_INSOLUBLE` | 1.30 kg/L | Insoluble pulp/skin solids | `practice` |

**Honey extract calibration (discovered in the Step 4 skeptic pass).** Treating
honey's ~82 % refractometer solids as if they were sucrose predicts a honey
density of ≈ 1.44 kg/L and ≈ 37.9 PPG — both too high versus the measured
≈ 1.42 kg/L and the empirical 35–37 PPG. The solver therefore uses honey's
**sucrose-equivalent extract**, derived from its measured density by inverting
the Lincoln equation:

```
E_honey = sgToPlato(ρ_honey / ρ_water) / 100      → ρ = 1.42 ⇒ E ≈ 0.797
```

One parameter (density) now drives both volume conversion and sugar
contribution, and reproduces ≈ 36.5 PPG (unit tested). The `solids` field in
`honeys.json` is kept as a display value only.

### 2.2 Enological constants

| Symbol | Value | Meaning | Source |
|---|---|---|---|
| `DRY_FG_DEFAULT` | 0.996 | Typical terminal gravity of a fully dry mead (alcohol < water density) | `practice` |
| `POINTS_TO_RS` | 2.6 g/L per gravity point | Residual sugar estimate above dry baseline (≈ 1 °Bx ≈ 10.3 g/L ≈ 4 pts) | `practice` |
| `FERMAID_O_YAN` | 40 mg N/L per 1 g/L (label) | Scott Labs label value | `scott-handbook` |
| `ORGANIC_N_MULTIPLIER` | 4 | TOSNA: organic N is ~4× as effective as inorganic → **effective 160 mg/L per g/L** | `tosna` |
| `FERMAID_K_YAN` | 100 mg N/L per 1 g/L | Scott Labs label | `scott-handbook` |
| `DAP_YAN` | 210 mg N/L per 1 g/L | DAP is 21.2 % N by mass | `scott-handbook` |
| `GOFERM_RATIO` | 1.25 g Go-Ferm per g yeast | Rehydration nutrient | `scott-handbook`, `tosna` |
| `DAP_LEGAL_MAX` | 0.968 g/L | US TTB 27 CFR 24.246 (8 lb / 1000 gal) | `ttb-24-246` |
| `DAP_ABV_CUTOFF` | 9 % ABV | Yeast stop taking up inorganic N | `scott-handbook` |

### 2.3 Unit conversions (exact)

| From → To | Factor |
|---|---|
| US gal → L | 3.785411784 |
| lb → kg | 0.45359237 |
| oz → g | 28.349523125 |
| oz/gal → g/L | 7.489151707 |
| PPG ⇄ PKL | PPG = PKL × (0.45359237 / 3.785411784) = PKL × 0.119826 |

*PKL* = gravity points × litres / kg (the metric analogue of PPG).

---

## 3. Gravity ⇄ Sugar (gravity.ts)

### 3.1 Plato/Brix → SG (Lincoln equation)
```
SG = 1 + P / (258.6 − (P / 258.2) × 227.1)
```
Valid 0–40 °P, error < 0.0005 SG vs. sucrose tables. (`lincoln`, `asbc`)

### 3.2 SG → Plato — the exact algebraic inverse of 3.1
Let k = 227.1/258.2 = 0.879551, x = SG − 1:
```
P = 258.6 × x / (1 + k × x)
```
We use the exact inverse (not the ASBC cubic) so that `sgToPlato(platoToSg(P)) ≡ P`;
round-tripping must never drift. Brix ≡ Plato for our purposes (difference < 0.05).

### 3.3 Blending two liquids
Mass-based (exact under the Plato model):
```
m_i = V_i × SG_i × ρ_w ;  S_i = m_i × P_i / 100
P_mix = 100 × ΣS_i / Σm_i ;  SG_mix = platoToSg(P_mix)
V_mix = Σm_i / (SG_mix × ρ_w)
```
ABV of a blend (alcohol is conserved by volume to ±0.2 %): `ABV_mix = ΣV_i·ABV_i / ΣV_i`.

---

## 4. ABV — The Alternative Equation (abv.ts) — STRICTLY ENFORCED

```
ABV(%) = [ 76.08 × (OG − FG) / (1.775 − OG) ] × [ FG / 0.794 ]
```

* The first bracket is **alcohol by weight** (ABW). The second converts ABW →
  ABV via the ratio of the finished mead's density (≈ FG) to ethanol's
  density (0.794 g/mL). That conversion is exact physics:
  `ABV = ABW × ρ_mead / ρ_ethanol`.
* The ABW term comes from Balling's fermentation stoichiometry
  (2.0665 g extract → 1 g ethanol + 0.9565 g CO₂ + 0.11 g yeast), re-expressed
  in SG by **Michael L. Hall, "Brew by the Numbers — Add Up What's in Your
  Beer", *Zymurgy*, Summer 1995**. The `(1.775 − OG)` denominator is what makes
  the equation non-linear: it corrects for the growing mass-per-point of extract
  at high gravity, which is exactly where the linear `131.25` rule
  under-reports (it is a low-gravity beer approximation).
* Popularised as the "alternate" formula by Brewer's Friend, which recommends
  it for high-gravity beverages. (`hall-1995`, `brewersfriend-abv`)

**Rules**
1. The linear `(OG − FG) × 131.25` formula is **never used for any computed
   value** in the app. It appears only inside the citation panel as a
   labelled "why not linear" comparison.
2. Domain: `1.000 ≤ OG < 1.775`, `0.980 ≤ FG ≤ OG`. Out-of-domain → typed error.
3. Benchmarks (unit tested, tol ±0.005 %):

| OG | FG | Alt ABV % | (Linear, for contrast) |
|---|---|---|---|
| 1.050 | 1.010 | 5.3394 | 5.25 |
| 1.090 | 0.996 | 13.0962 | 12.34 |
| 1.100 | 1.000 | 14.1954 | 13.13 |
| 1.120 | 1.000 | 17.5546 | 15.75 |
| 1.130 | 1.010 | 18.0050 | 15.75 |
| 1.150 | 1.020 | 20.3289 | 17.06 |

**Inverse (used for FG prediction):** `fgForAbv(OG, ABV)` solves the equation
for FG by bisection on [0.980, OG] (ABV is strictly decreasing in FG on this
interval). Tolerance 1e-7.

---

## 5. Must Solver — Sugar, Fruit & Displacement (must.ts)

### 5.1 Model
The must is a solution of dissolved solids (sugars) in water. We track
**mass**, not volume, and derive volume from density. Volumes of sugar
solutions are *not* additive, so we never sum ingredient volumes to get the
liquid volume.

Inputs (SI): target liquid volume `V_t` (L) — the volume of liquid must
**after fruit has released its juice** — plus ingredient list:

| Ingredient | Contributes dissolved solids S | Contributes liquid mass | Insoluble |
|---|---|---|---|
| Honey (mass m, solids fraction h) | m·h | m | — |
| Sugar (mass m, purity p) | m·p | m | — |
| Fruit (mass m, juice Brix B, insoluble fraction i) | m·(1−i)·B/100 | m·(1−i) | m·i |
| Water (mass W, **unknown**) | 0 | W | — |

### 5.2 Solving for water (target-volume mode)
```
M(W) = Σ liquid mass + W ;  S = Σ solids
P(W) = 100·S / M(W) ;  SG(W) = platoToSg(P(W))
V(W) = M(W) / (SG(W)·ρ_w)
Find W ≥ 0 such that V(W) = V_t   (bisection; V is strictly increasing in W)
```
If even W = 0 gives V > V_t, the recipe is infeasible: the solver returns
`W = 0`, the actual volume, and an `overVolume` error.

**Fixed-water mode** is also supported: W given, V and OG derived.

### 5.3 Fruit displacement & fermenter occupancy
* **Juice displacement:** the fruit's soluble mass `m(1−i)` becomes liquid, so
  it **replaces** water you would otherwise add.
* **Initial occupancy** (day 0, fruit intact):
  `V_occ0 = V(liquid excluding fruit juice) + m_fruit / ρ_fruit_whole`.
* **Post-breakdown occupancy:** `V_t + m_fruit·i / ρ_insoluble`.
* **Required fermenter size:** `max(V_occ0, V_occ1) × (1 + headspace)`, with
  headspace 20 % for traditionals, 30 % when fruit is in primary (cap rises).
* **Expected recovered volume after racking:**
  `V_t − m_fruit × retention − V_t × lees_loss` with retention per fruit
  (default 0.15 L/kg) and lees_loss 5 %.

### 5.3a Edge case: no water
If W = 0 and the mixture exceeds 85 °P (e.g. a dry-sugar-only recipe), it is
not a solution: volume = solids/1.587 + remainder/ρ_w (solid phase). This is
only ever hit at the solver's lower bound and in over-volume detection.

### 5.4 Per-ingredient gravity contribution
For each ingredient, `ΔOG = OG(all) − OG(all without it, same V_t)`.
Normalised: `PKL = ΔOG_points × V_t / m` and `PPG = PKL × 0.119826`.

### 5.6 Secondary fruit
Fruit marked *secondary* is excluded from the measured OG (it isn't in the
must at pitch). For ABV, the whole batch is re-solved with the **same water**
and all components ⇒ *effective OG* and final volume. Sugar and alcohol are
conserved, so `ABV = ABV(effective OG, FG)`. Note: juice lighter than the must
(e.g. 14 °Bx cherry vs. a 1.094 must) **lowers** the effective OG — it dilutes.

### 5.5 Skeptic-pass benchmark (unit tested)
**10 L target, 3 kg strawberries (8 °Bx, i = 0.05), 3 kg honey (82 %):**
* fruit solubles 2.85 kg (0.228 kg sugar), honey 3.00 kg (2.46 kg solids)
* Water to add must be ≈ 2.7–2.8 L **less** than the honey-only version.
* Day-0 occupancy ≈ (10 − ~2.75) L + 3/1.05 = 2.86 L ⇒ ≈ 10.1 L — the
  fermenter must hold ≥ ~13 L with 30 % headspace.
* Sanity anchor: 1 lb honey in 1 US gal total ⇒ OG ≈ 1.035–1.037 (classic
  "35 PPG" rule).

---

## 6. Fermentation Model (fermentation.ts)

### 6.1 Predicted FG
1. `ABV_dry = ABV(OG, DRY_FG)`.
2. If `ABV_dry ≤ yeast.tolerance` → `FG = DRY_FG` (ferments dry).
3. Else → `FG = fgForAbv(OG, yeast.tolerance)` (yeast quits, sugar remains).
4. A user "target FG" (stabilise & back-sweeten, or stop early) overrides.

### 6.2 Sweetness (FG convention used by mead calculators)
| Dry | Semi-sweet | Sweet | Dessert |
|---|---|---|---|
| ≤ 1.006 | 1.006–1.015 | 1.015–1.025 | > 1.025 |

Residual sugar estimate: `RS ≈ max(0, FG − DRY_FG) × 1000 × 2.6 g/L`.

### 6.3 Strength (traditional mead terms, own thresholds)
Hydromel 3.5–7.5 % · Standard 7.5–14 % · Sack 14–18 %. These are long-standing
meadmaking terms. The app does **not** reproduce or claim BJCP guidelines (see §15).

### 6.4 Sugar breaks
`1/3 break SG = OG − (OG − FG_pred)/3`; `1/2 break = OG − (OG − FG_pred)/2`.

---

## 7. Yeast & Nutrient Kinetics (nutrients.ts)

### 7.1 YAN requirement
```
YAN_req (mg N/L) = Brix × 10 × f
f = 0.75 (Low) · 0.90 (Medium) · 1.25 (High) · 1.50 (Very High)
```
Brix = `sgToPlato(OG)`. Example: OG 1.100 → 23.8 °Bx, Medium → 214 ppm.
(`scott-handbook`, `tosna`, `meadmaderight`)

**Credits:** optional fruit YAN credit = Σ(fruit juice volume × fruit YAN) / V_t.
Off by default — fruit YAN numbers vary ±50 %, and honey YAN is treated as 0.

### 7.2 Protocols
All protocols split the requirement over **4 equal additions**:

| Addition | Trigger |
|---|---|
| 1 | 24 h after pitch |
| 2 | 48 h |
| 3 | 72 h |
| 4 | 1/3 sugar break (SG from §6.4) **or day 7, whichever comes first** |

| Protocol | Products | Dose maths |
|---|---|---|
| **TOSNA 3.0** (default) | Fermaid O only | `FO_total(g) = YAN_req / 160 × V` (160 = 40 × 4 effective organic factor); each dose = FO_total/4 |
| **Fermaid K + DAP** | K for organic+inorganic, DAP for the rest | YAN split 50 % K / 50 % DAP; K(g) = 0.5·YAN/100·V, DAP(g) = 0.5·YAN/210·V; DAP **only in doses 1–3** (redistributed); dose 4 = K only |
| **Fermaid O + K** (hybrid) | O doses 1–2, K doses 3–4 | each dose = YAN/4; O at 160, K at 100 mg/L per g/L |

Rehydration: yeast mass = `max(2 g/gal, 0.5 g/L)`; scaled to `1 g/L` when OG > 1.120.
Go-Ferm = 1.25 × yeast mass, rehydrated in 20 × its mass of 43 °C water.

### 7.3 Guard rails (generate advisories)
* DAP total > 0.968 g/L → **error** (exceeds US legal limit).
* DAP scheduled after the 1/3 break or after 9 % ABV → **error**.
* Fermaid K single dose > 0.5 g/L → warning.
* YAN_req > 400 ppm → warning: consider step-feeding honey.

---

## 8. Flavor Intelligence Engine (flavor.ts)

A deterministic rule engine: `advise(Analysis) → Advisory[]`, with
`Advisory = { id, severity: 'info'|'tip'|'warning'|'error', category, title, detail, suggestion?, source[] }`.

### 8.1 Fruit load (melomel)
`load = Σ fruit kg / V_t (kg/L)`:

| Light | Standard | Heavy | Extreme |
|---|---|---|---|
| < 0.15 | 0.15–0.35 | 0.35–0.60 | > 0.60 |

(0.15–0.35 kg/L ≈ 1.25–3 lb/gal, the range Schramm and Piatz suggest for a
fruit-forward but honey-led melomel.) Heavy → recommend pectic enzyme,
staged fruit (½ primary, ½ secondary), larger headspace and a cap-punching schedule.

### 8.2 Acid balance
* Estimated must TA (g/L, tartaric eq.) = Σ fruit juice L × TA_fruit × conv / V_t,
  with conv: citric → 1.172, malic → 1.119, tartaric → 1.0. Honey contributes
  ≈ 0.5 g/L (gluconic), treated as a flat base.
* Target TA by sweetness: Dry 4.5–6 · Semi-sweet 5.5–7 · Sweet 6.5–8 · Dessert 7–9 g/L.
* `TA < target_min` → tip: add `(target_mid − TA) × V` g acid blend **post-
  fermentation, to taste via bench trials**.
* `TA > target_max` with FG ≤ 1.006 → warning: may taste sharp; finish
  sweeter or deacidify with K₂CO₃ (≈ 1 g/L lowers TA by ≈ 1 g/L).
* *(Replaced by §22.4.)* pH advice now comes from the acid–base model, not a fixed fruit-pH rule.

### 8.3 Tannin & structure
* Sweet/dessert finish and no tannic ingredient → tip: 0.1–0.3 g/L wine
  tannin or 2–4 g/L medium-toast oak cubes to stop it tasting cloying.
* Strongly tannic fruit (elderberry, black currant, cranberry) > 0.3 kg/L
  → tip: plan 6–12 months of ageing.

### 8.4 Body (thin-finish detector)
* ABV < 7.5 (hydromel) and FG ≤ 1.004 → warning: "may finish thin". Suggest:
  stabilise at 1.006–1.010, a lower-attenuating yeast, 0.05–0.1 g/L tannin,
  carbonation, or an aromatic varietal honey.
* Any finish with ABV > 14 % and FG ≤ 0.998 → info: hot finish; ageing or a
  slight back-sweeten to 1.004–1.010 integrates alcohol.

### 8.5 High-gravity & tolerance
* OG > 1.130 → warning: osmotic stress; step-feed ⅓ of the honey at the 1/3 break.
* `ABV_dry − tolerance > 2 %` → warning: will finish sweet (show predicted FG).
* Predicted FG > 1.030 → warning: cloying, high stuck-fermentation risk.

### 8.6 Spice dosing (metheglin)
Every spice in `spices.json` has `g/L` bands `{subtle, typical, bold, max}`
and a recommended contact time.

| Dose vs. band | Severity |
|---|---|
| < subtle | info "may be imperceptible" |
| subtle–bold | ok (shows where in the band it sits) |
| bold–max | warning "assertive; taste every 2–3 days" |
| > max | **error "astronomically high — will dominate"** + suggested dose |
| > 3 × max | **error** + "check units (g vs kg, per L vs per batch)" |

**Combined intensity:** `I = Σ dose_i / typical_i`. If `I > 2.5` → warning:
the spices will compete; scale down to the typical dose of one lead spice.

Guidance on all spice dosing: add in secondary in a sanitised bag, taste
every 48 h, remove early. **The bands are practitioner consensus, not hard
science** — the UI says so.

### 8.7 Pairings & suggestions
`pairings.json` lists affinity pairs (fruit ↔ spice, honey ↔ fruit) with a
note. For each fruit/honey in the recipe, the engine suggests ≤ 3 partners
that aren't already used, with the suggested starting dose (the spice's `typical` band).

### 8.8 Honey character
Varietal notes (e.g. buckwheat → assertive, pairs with dark fruit and baking
spice; orange blossom → delicate, keep spice ≤ subtle).

---

## 9. Citation Registry (sources.ts)

| id | Citation |
|---|---|
| `hall-1995` | Hall, M. L. "Brew by the Numbers — Add Up What's in Your Beer." *Zymurgy*, Summer 1995. |
| `brewersfriend-abv` | Brewer's Friend, "Alcohol by Volume Calculator — alternate formula" (brewersfriend.com/abv-calculator). |
| `balling` | Balling, C. J. N. (1865) fermentation stoichiometry 2.0665 : 1 : 0.9565 : 0.11. |
| `lincoln` | Lincoln equation, Plato ⇄ SG approximation (as used in brewing software). |
| `asbc` | ASBC Methods of Analysis, Table 1 — Extract in wort and beer. |
| `crc-water` | CRC Handbook of Chemistry and Physics — density of water vs. temperature. |
| `crc-sucrose` | CRC Handbook — density of crystalline sucrose. |
| `nhb-honey` | National Honey Board, "Honey — Composition & Properties" (moisture 17–18 %, density ≈ 1.42 kg/L). |
| `white-1975` | White, J. W. "Composition of Honey", in *Honey: A Comprehensive Survey* (Crane, ed.), 1975. |
| `usda-fdc` | USDA FoodData Central — fruit sugars, moisture. |
| `tosna` | Moutela, S. *TOSNA 3.0* — Tailored Organic Staggered Nutrient Additions (tosna.org). |
| `scott-handbook` | Scott Laboratories, *Fermentation Handbook* (annual) — nutrient YAN values, yeast nitrogen classes. |
| `meadmaderight` | Mead Made Right — nutrient & YAN guidance (meadmaderight.com). |
| `ttb-24-246` | 27 CFR § 24.246 — Materials authorized for treatment of wine (DAP limit). |
| `bjcp-2015` | BJCP 2015 Mead Style Guidelines (strength/sweetness categories). |
| `schramm` | Schramm, K. *The Compleat Meadmaker*, Brewers Publications, 2003. |
| `piatz` | Piatz, S. *The Complete Guide to Making Mead*, Voyageur Press, 2014. |
| `zoecklein` | Zoecklein, B. et al. *Wine Analysis and Production* — TA, pH, acid conversions. |
| `practice` | Practitioner consensus / commercial practice; treat as guidance, not law. |

Every numeric constant and every database row references at least one id.
The UI exposes a **Sources** drawer and a per-formula **"Show proof"** panel.

---

## 10. Data Schemas (src/data)

```ts
Honey  { id, name, solids: number /*0–1*/, density: number /*kg/L*/, character: string, intensity: 1|2|3, source: string[] }
Fruit  { id, name, brix, insoluble /*0–1*/, ta /*g/L*/, acid: 'citric'|'malic'|'tartaric',
         ph, tannin: 0|1|2|3, yan /*mg N/L juice*/, retention /*L/kg*/, notes, source[] }
Spice  { id, name, form, subtle, typical, bold, max /*g/L*/, contactDays: [min,max], notes, source[] }
Yeast  { id, name, maker, tolerance /*% ABV*/, nDemand: 'low'|'medium'|'high'|'veryHigh',
         tempC: [min,max], notes, source[] }
Pairing{ a, b, note }
```
Yeast nitrogen classes follow manufacturer/Scott Labs data at the time of
writing; the UI lets the user override demand, because manufacturers revise them.

---

## 11. Testing Contract
* `abv.test.ts` — every §4 benchmark, domain errors, monotonicity, inverse round-trip.
* `gravity.test.ts` — Plato/SG round-trip, sucrose anchors (10 °P ≈ 1.0400, 20 °P ≈ 1.0830), blending.
* `must.test.ts` — 35-PPG honey anchor, the §5.5 3 kg-fruit/10 L audit, infeasible over-volume.
* `nutrients.test.ts` — YAN formula, 4-dose partition sums to total, DAP never after break, legal limit.
* `flavor.test.ts` — spice bands incl. "astronomical", thin-hydromel warning, acid tip.

## 12. Skeptic-Pass Checklist
- [x] Fruit juice volume subtracted from water (not added on top).
- [x] OG computed from mass balance, not additive volumes.
- [x] Nutrient doses sum exactly to the total; dose 4 at the ⅓ break or day 7.
- [x] No inorganic N (DAP) at/after the ⅓ break.
- [x] Linear ABV appears only in the proof panel.
- [x] Imperial toggle changes display only, never the stored SI state.
- [x] Honey extract calibrated from density (≈ 36.5 PPG), not raw solids.

### 12.0 Audit log (Step 4 results)
| Check | Result |
|---|---|
| 3 kg strawberries → 10 L | Water reduced by **2.77 L**; day-0 occupancy **10.09 L**; fermenter ≥ **13.1 L** (30 % headspace); recovered ≈ 9.05 L. ✔ |
| Honey PPG | Raw 82 % solids gave 37.9 PPG (too high) → **fixed** with density calibration → 36.5 PPG. ✔ |
| Sucrose PPG | 46 ± 0.5 (brewing reference). ✔ |
| Dry-sugar-only recipe | Crashed (100 °P out of Lincoln range) → **fixed** with solid-phase branch (§5.3a). ✔ |
| Secondary fruit | Initial test assumed it raises OG; physics says lighter juice dilutes → **test corrected**, sugar conservation asserted. ✔ |
| SNA partition | 4 doses at 24/48/72 h + ⅓ break/day 7; sums exact; DAP never in dose 4. ✔ |
| Linear ABV | Only in `linearAbvForComparisonOnly`, used solely by the proof panel. ✔ |

### 12.1 Unit display conventions
Volume (L ⇄ gal) and bulk mass (kg ⇄ lb) follow the toggle. **Spices and
nutrients are always shown in grams** in both systems, as TOSNA and most
meadmakers weigh them; dose bands show g/L and, in Imperial, g/gal too.


---

## 13. Sulfite Management (sulfite.ts)

### 13.1 Equilibrium (revised 2026-10-26, pH audit)
Free SO₂ = molecular SO₂ (antimicrobial) + bisulfite HSO₃⁻, in pH-dependent equilibrium:
```
molecular fraction = 1 / (1 + 10^(pH − pKa)) ;  free_needed = molecular_target ÷ fraction
pKa = OIV apparent constant at 20 °C by alcohol (OIV-MA-AS323-04C Table II, I = 0.038):
      0 % 1.723 · 5 % 1.819 · 10 % 1.916 · 15 % 2.014 · 20 % 2.114   (linear interpolation)
```
**Why it changed:** v1 used the aqueous pKa 1.81 for every mead. Alcohol raises the pKa, so at
12 % ABV (pKa 1.955) a mead holds **~40 % more molecular SO₂** per mg of free SO₂ than the old
formula assumed, and the old figures over-dosed SO₂ by about that much. Example: pH 3.6, 0.8 mg/L
target: 50 mg/L free (old) → 36 mg/L free (new). Unit tests reproduce nine published Table III cells.
20 °C is the standard measurement temperature, the one the 0.5–0.8 mg/L molecular targets refer to.
**pH source:** the predicted finished pH from §22 by default; the user can tick "I measured it" and enter a meter reading.

### 13.2 Addition
| Quantity | Formula |
|---|---|
| SO₂ to add (mg/L) | `max(0, free_needed − free_current) / (1 − binding)` |
| SO₂ mass (g) | `add × V / 1000` |
| K-meta (g) | `SO₂ g / 0.5763` (2 × 64.066 / 222.32) |
| Na-meta (g) | `SO₂ g / 0.6740` (2 × 64.066 / 190.1) |
| Campden tablets | `K-meta g / 0.44` (typical US tablet: check brand) → 1 tab/gal ≈ 67 mg/L |
| 10 % K-meta stock (mL) | `SO₂ g / (0.1 × 0.5763)` → 57.6 mg SO₂ per mL |
| Free after | `free_current + add × (1 − binding)` |
| Total after | `max(total_current, free_current) + add` |
| Bound after | `total − free` |

Defaults: target molecular 0.8 mg/L (0.5 for tannic meads), binding 25 %, pH 3.6, volume = expected
recovered volume (§5.3) + secondary juice.

**Sorbate** (auto-on when a target FG is set): 0.2 g/L potassium sorbate = 149 mg/L sorbic acid
(MW 112.13 / 150.22). Never added without SO₂ (geranium off-odour risk).

### 13.3 Limits & guard rails
| Check | Value | Source |
|---|---|---|
| US total SO₂ | ≤ 350 mg/L → error | 27 CFR 4.22(b)(1) (`ttb-4-22`) |
| EU mead total SO₂ | ≤ 200 mg/L → warning | Reg. 1333/2008 Annex II cat. 14.2.5 (`eu-1333`) |
| US "Contains sulfites" label | total ≥ 10 mg/L → info | 27 CFR 4.32(e) (`ttb-4-32`) |
| US sorbic acid | ≤ 300 mg/L → error | 27 CFR 24.246 |
| pH > 3.8 | warning: acidify first | `margalit` |
| Molecular > 1.5 mg/L | warning: perceptible | `margalit` |

## 14. Export (export.ts)
* **Excel (.xlsx)** via ExcelJS (MIT licence), lazy-loaded. Six sheets: Summary, Ingredients,
  Nutrients, Sulfite, Advisor, Sources. Styled headers, input cells shaded yellow, number formats,
  frozen header rows.
* **Live formulas** with cached results: ABV/ABW (Summary B9/B10, which reference OG/FG input
  cells), YAN target, nutrient totals, ingredient totals, kg→lb and L→gal conversions, and the entire
  Sulfite sheet (a working calculator). `fullCalcOnLoad` is set so Excel recalculates on open.
* **Verified:** a copy with every cached result zeroed was recalculated in LibreOffice and
  reproduced the app's values exactly (ABV, K-meta grams, total SO₂, Fermaid O, YAN).
* **Google Sheets:** upload the .xlsx to Drive (formulas carry over), or use *Copy for Google
  Sheets*, a tab-separated values summary that pastes directly.
* In the claude.ai artifact the file is offered through the `downloads` capability (viewer
  confirms the save). Locally it is an ordinary browser download.

## 15. Source Licensing Audit (done 2026-10-26)

**Principle.** Formulas, methods, procedures and numeric facts are not protected by copyright
(17 U.S.C. §102(b); *Feist v. Rural*, 499 U.S. 340 (1991)). Expression (prose, tables, code, page
layouts) is. The app therefore re-implements logic from first principles, credits the origin,
and never copies third-party text, tables or code. Each source carries a `license` and `usage`
field in `sources.ts`, shown in the Sources drawer and the export's Sources sheet.

| Source | Finding | Handling |
|---|---|---|
| USDA FoodData Central | Public domain, CC0 1.0; attribution requested | Credited; fruit rows are our own rounded estimates |
| eCFR (27 CFR 4.22, 4.32, 24.246) | US government work, public domain | Limits used directly |
| EUR-Lex (Reg. 1333/2008) | Reuse permitted with acknowledgement (Decision 2011/833/EU) | Limit value used, acknowledged |
| Hall 1995 / Brewer's Friend | Copyrighted publications; formula itself is a fact | Formula re-implemented and cited; no text or code copied |
| Balling 1865 | Public domain (age) | Ratios used |
| Lincoln eq., ASBC, CRC, NHB, White, Zoecklein, Margalit, Usseglio-Tomasset | Copyrighted works | Facts/constants only, cited |
| Scott Labs handbook | Copyrighted; product names are Lallemand trademarks | Numeric facts only; trademark notice in app & export |
| Schramm, Piatz | Copyrighted books | General guidance informs our own dose bands; no text |
| **BJCP guidelines** | Terms: apps must obtain permission and show an in-app permission/copyright notice; reposting not allowed | **Logic only.** Strength/sweetness use traditional mead terms with our own thresholds; no BJCP text, numbering or claim of BJCP conformance; linked for further reading only |
| **TOSNA** | Original site (tosna.org) no longer resolves; no license found | **Logic only.** Method implemented independently and attributed by name; no text or calculator code reproduced |
| **Mead Made Right** | Terms could not be verified | **Logic only.** Uses the general industry relation Brix × 10 × demand factor |
| ExcelJS (npm dependency) | MIT licence | Bundled under MIT |
| FDA "Approximate pH of Foods" | US government work, public domain | Fruit pH ranges used directly |
| White et al. 1962 (USDA Tech. Bull. 1261) | US government work, public domain | Honey pH and acidity averages |
| Clemson Extension pH table | Copyrighted extension page | Cross-check only (facts) |
| BRsquared fruit TA table | Copyrighted website | Cross-check only (facts); no table reproduced |
| OIV SO₂ method, Pereira 2015, AHA water study | Copyrighted publications | Numeric facts and measurements only, cited |


---

## 16. Flags on Demand (flags.ts) — UX rule
Warnings and errors **never interrupt the recipe flow**. They are collected by `collectFlags()`
from advisories (warning/error), nutrient guard rails, sulfite limits and the batch log (stuck
ferment, overdue dose), and shown only when the user taps **Check recipe**. The button carries a
quiet neutral count; it turns dark (not red) when a must-fix error exists.
Inline, the app shows only positive or neutral information: dose meters, numbers, suggestions
(tip/info) and pairings. In-band spice doses produce no advisory, since the meter already shows them.

## 17. Dose Bands for Fruit, Flowers & Herbs
One classifier `doseBand(bands, dose)` serves spices and flowers (g/L) and fruit (kg/L of final
volume): imperceptible < subtle ≤ typical ≤ bold < assertive ≤ max < astronomical, with
"check units" above 3 × max. Every fruit has its **own** scale, because intensity differs
widely. 0.3 kg/L is bold for raspberry and subtle for blueberry.

| Fruit (kg/L) | subtle | typical | bold | max |
|---|---|---|---|---|
| Black currant, elderberry | 0.05 | 0.12 | 0.20 | 0.35 |
| Cranberry | 0.06 | 0.15 | 0.25 | 0.40 |
| Raspberry | 0.08 | 0.18 | 0.30 | 0.50 |
| Blackberry | 0.10 | 0.22 | 0.35 | 0.60 |
| Tart cherry, pomegranate | 0.10 | 0.25 | 0.40 | 0.60 |
| Strawberry, sweet cherry, apricot, plum, mango, pineapple | 0.12–0.15 | 0.30 | 0.45 | 0.70 |
| Blueberry, peach | 0.15 | 0.35 | 0.50 | 0.80 |
| Apple, pear, grape | 0.20 | 0.40 | 0.60 | 0.9–1.0 |
| Apple juice (cyser) | 0.20 | 0.50 | 0.70 | 1.00 |
| Banana | 0.05 | 0.12 | 0.20 | 0.30 |

Botanicals carry a `group` (spice · adjunct · floral · herb) and appear in two panels:
*Spices & Adjuncts* and *Flowers & Herbs*. New florals and herbs: elderflower, meadowsweet, orange
blossom, jasmine, butterfly pea, linden, calendula, rosehip, heather tips, mint, thyme. Optional
fields: `flavour` (weight; butterfly pea 0.15, as it is mostly colour) and `acidPerG` (hibiscus 0.6,
rosehip 0.3 g/L TA per g/L, fed into the TA estimate). Fruit above `max` raises an error flag, and
above `bold` a warning. All bands are practitioner consensus (`practice`, `schramm`).

## 18. Flavour Profile, Tasting Note, Colour (profile.ts)
Nine 0–10 axes from the recipe's numbers (illustrative, not sensory data):
* Sweetness = (FG − 0.994)/0.046 × 10 · Acidity = (TA − 2)/7 × 10
* Body = (FG − 0.990)×120 + ABV×0.15 + fruit kg/L×2 · Warmth = (ABV − 3)/17 × 10
* Tannin = Σ fruit tannin × min(1.5, dose/typical) × 1.6 + oak/cacao/coffee intensity × 3
* Fruit / Spice / Floral = Σ (dose/typical × flavour weight) × 5
* Honey = varietal intensity × min(1.2, honey kg/L / 0.3) × 3.3 − masking by fruit, spice and floral
Tasting note: sweetness, body and strength words, then up to three lead aromas ranked by dose/typical,
then acidity, tannin and finish words. Colour: RGB blend from near water-white toward the honey
colour (by honey kg/L), then toward each fruit's juice colour and pigmenting botanicals (hibiscus,
butterfly pea, rosehip…) by dose/typical, and named by hue and lightness.
Bottles: floor(recovered L / size) for 750 / 500 / 375 / 330 mL.

## 19. Designer (designer.ts) & Presets (presets.ts)
* `ogForTarget(ABV, FG)` inverts the Alternative ABV equation by bisection.
* `designForTarget(recipe, ABV, FG)` scales the honey (keeping varietal ratios) by bisection on the
  analysed effective OG, so fruit and sugar contributions are counted. A finish above the dry
  baseline becomes the recipe's target FG. Notes: yeast tolerance, over-volume, stabilisation.
* `scaleRecipe(recipe, k)` scales volume, water and every ingredient; OG, ABV and dose bands are invariant (tested).
* 10 style presets defined per 10 L and scaled to the current batch. Each must analyse with
  **zero error flags** (unit tested).

## 20. Batch Log (tracker.ts)
Stored in the recipe (`log`: pitch time, SG readings, doses done). `trackerStatus(log, OG, FG, now)`:
* Doses 1–3 due at pitch + 24/48/72 h (overdue 12 h after). Dose 4 due at the ⅓ break
  (from **measured** OG) or day 7, whichever comes first.
* Live ABV from the first reading (Alternative equation) and % sugar used.
* Stage: lag, active, slowing (past ¾), **stable** (≥3 readings over ≥2.5 days, drop < 0.0015,
  within 0.004 of FG), or **stuck** (the same, but above FG + 0.004 → flag).
* SVG chart of SG over days with ⅓-break and expected-FG reference lines.
* Exported as a *Log* sheet with live ABV formulas.

## 21. Performance
* Analysis runs on `useDeferredValue(recipe)`, so typing is never blocked by recalculation.
* The target solver (~60 analyses) runs only while its panel is open.
* Artifact build: ExcelJS loads from cdnjs (pinned 4.4.0) on the first export instead of being
  inlined. The page dropped from 1.2 MB to ~320 KB. The normal build keeps it as a lazy chunk.


## 22. Acid–Base & pH Model (acidbase.ts, phmodel.ts) — added after the pH audit

### 22.1 Why a model
v1 never computed pH from the recipe. The sulfite panel used a fixed default of 3.6, and one rule
flagged any fruit with juice pH ≤ 3.0 above 0.2 kg/L. pH also doesn't blend linearly: a buffered
juice diluted 1:4 rises by under 0.35 pH (tested), while honey musts have almost no buffering.

### 22.2 Chemistry
Each ingredient becomes a pool of weak organic acids (mol/L) plus strong-base cations (eq/L).
pH solves the charge balance `[H⁺] + cations = Σ Cᵢ·q̄ᵢ(pH) + [OH⁻]`, where q̄ is the mean
negative charge from each acid's pKas (CRC, 25 °C). Activity correction (Davies equation) at ionic
strength I: `pKa'ⱼ = pKaⱼ − 2j·0.51·(√I/(1+√I) − 0.3I)`.
* **Fruit**: rebuilt from its measured juice pH and TA (dominant acid). Two linear equations give
  acid C and cation K (`h + K = C·q̄`, `TA = nC − K`), so every juice reproduces its own pH exactly.
  pH: FDA list, cross-checked with Clemson. TA: cross-checked with BRsquared (all within range).
* **Honey**: gluconic acid (pKa 3.86). Cations are back-solved from honey pH 3.9 at 10 g/75 mL with
  free acidity 22 meq/kg; lactones (7 meq/kg) hydrolyse by the finished stage (White 1962).
  Darker honeys (buckwheat, avocado, heather) use higher acidity and pH.
* **Water**: alkalinity (mg/L CaCO₃ ÷ 50 = meq/L) acts as strong base. Presets run from RO 0 to hard 250.
* **Botanicals**: `acidPerG` (hibiscus, rosehip) as free citric acid, in the finished mead only.
* **Additions**: tartaric, malic, citric or lactic acid (free acid); KHCO₃, K₂CO₃ or CaCO₃ (base eq/g).
  Stage is "must" or "finished".
* **Fermentation**: succinic acid = 0.0025 × sugar fermented (g/L) (0.63 g/L at 250 g/L, inside
  the 0.5–1.5 g/L wine range), plus 0.4 g/L acetic acid and 0.5 meq/L cation uptake by yeast.

### 22.3 Calibration (fitted, then frozen in tests)
Free parameters were fitted by grid search, with succinic acid constrained to the literature range:
honey pH shift −0.15, I = 0.05, succinic 0.0025, uptake 0.0005.

| Published measurement | Measured | Model |
|---|---|---|
| AHA 2015, wildflower OG 1.100, distilled: must | 3.70 | 3.72 |
| … finished, distilled water | 3.40 | 3.40 |
| … finished, low-alkalinity water | 3.50 | 3.46 |
| … finished, hard water (alkalinity assumed 250) | 3.80 | 3.69 |
| Pereira 2015, 37 % honey + additions: must | 3.67 | 3.69 |
| … finished | 3.55–3.68 | 3.60 |
| … TA must (g/L tartaric) | 4.28 | 3.95 |

RMS error over the four fitted pH points: **0.018**. The UI shows ±0.2 because honey pH varies from
3.4 to 6.1. Known weakness: finished TA reads 1–1.5 g/L low against Pereira, whose stressed
ferments probably made more acetic acid. Nutrient salts (DAP) are not modelled.

### 22.4 Outputs & advice
* Must and finished pH, must and finished TA, and each ingredient's ΔpH ("What moves the pH").
* Fruit dose curve: finished pH at the subtle, typical, bold and max dose for each fruit.
* "How much to reach a pH?": bisection on grams of tartaric acid or KHCO₃.
* Advice: must pH < 3.0 → **flag** (yeast stress), with the KHCO₃ grams to reach 3.3. Must pH
  3.0–3.2 → tip. Finished pH > 3.8 → tip, with the tartaric grams to reach 3.6. Finished TA from the
  model feeds the acid-balance rules (§8.2).
* Representative pH (must → finished), 3 kg wildflower in 10 L, spring water, fruit at its typical dose:
  honey alone 3.80 → 3.45 · strawberry 3.57 → 3.42 · raspberry 3.52 → 3.38 · blueberry 3.46 → 3.32 ·
  tart cherry 3.41 → 3.34 · sweet cherry 3.86 → 3.68 · peach 3.67 → 3.53 · mango 4.18 → 3.85 ·
  black currant 3.22 → 3.14 · cranberry 2.94 → 2.88 (max dose 2.67 → 2.64) · hibiscus 1.5 g/L → 3.20.
  Water: RO 3.39 · average tap 3.50 · hard 3.65 (finished, honey only).
* SO₂ free needed for 0.8 mg/L molecular, v1 (pKa 1.81) vs v2 (12 % ABV, pKa 1.955):
  pH 3.3: 26 → 18 · pH 3.5: 40 → 29 · pH 3.6: 50 → 36 · pH 3.8: 79 → 57 mg/L.


## 14.2 Export audit & rebuild (2026-10-26)
**Findings in v1:** unnamed columns (botanicals table, Nutrients inputs, pairings, profile); "Fermentables"
sheet that also held spices; predicted OG labelled "measured"; pH stored as text; raw licence ids; no
pH sheet, batch size, water or saved version; sweetness, strength and RS frozen while ABV was live;
spice g/L divided by a hard-coded volume; static dose bands; nutrient doses not linked to YAN or volume;
SO₂ pKa not linked to ABV; product as a raw number; no place for measured OG/FG.

**Rebuild:**
* Sheets: **Read me** (hyperlinked index, key) · Summary · Ingredients · Nutrients · **Acidity** (new) ·
  Sulfite · Advisor · Log (when a batch has readings) · Sources (human licence labels, links).
* Every table has a header; blank spacer columns are unstyled; units in a column or the label.
* **Live formulas:** measured OG/FG inputs → OG/FG used → ABV, ABW, sweetness, RS, strength, ⅓ and ½
  breaks. Mass → sugar (kg) via a stored sugar fraction. Dose volume → g/L and kg/L → **dose band**
  (nested IF on subtle/typical/bold/max). Brix from the **primary** OG → YAN (demand **dropdown**
  → factor) → nutrient doses per **protocol dropdown** (TOSNA 3.0 / K + DAP / Hybrid), YAN delivered,
  totals, DAP legal check. Yeast, Go-Ferm and water from volume and OG. SO₂: ABV (linked to Summary)
  → OIV pKa (piecewise-linear formula) → product **dropdown** → fraction → molecular share → free
  needed → addition → grams, Campden, stock solution → after-values → legal check, plus a
  free-SO₂-by-pH table. Sorbate behind a Yes/No dropdown. Log ABV and % sugar used per reading.
* Data validation (ranges and lists), cell notes on headers, conditional colours (bands, legal checks),
  frozen headers, print setup (fit to width).
* Values from heavier models (mass balance, pH model, profile) are labelled "from the app".

**Verification (now permanent tests, `export.recalc.test.ts`):**
1. All cached results are zeroed and the workbook is recalculated by LibreOffice headless. Every
   formula cell must equal the app within 1e-6 relative. 1,097 cells across 13 recipes, then 3
   recipes in CI. This audit found and fixed:
   - stored inputs rounded to 2–3 dp (ABV drift 6.30 vs 6.33);
   - Brix rounded inside the YAN formula;
   - nutrients based on the *effective* OG, which includes secondary-fruit juice not yet in the must
     (they now use the primary OG, as the app does);
   - SO₂ fractions written to 4 dp.
2. Inputs are edited in the sheet (measured FG, protocol, demand, SO₂ product, pH, botanical grams),
   recalculated, and compared with the app's own analysis of the same change: exact.

## 23. Recipe Library (library.ts, store.ts)
* **Immutable versions.** `LibraryEntry {id, lineageId, parentId, version, name, author: you|ai, note,
  createdAt, recipe}`. Saving never overwrites: `deriveEntry` appends version max+1 in the lineage and
  deep-copies the recipe. Tests assert the parent is byte-identical afterwards.
* **Draft = a copy.** The editor holds a draft plus `baseId` (the version it was copied from) and a
  `dirty` flag. Opening any version loads a deep copy. "Save as vN" derives a new version; "Save as
  new recipe" starts a new lineage. Opening another recipe with unsaved changes asks: save first,
  discard, or cancel.
* **Storage.** Inside Claude: the artifact `db` capability under the viewer's private subtree
  `data/users/<id>/meadlab/library/recipes/<entryId>` (synced across devices, invisible to others; needs
  the `user` capability for the id). Elsewhere: localStorage, labelled "this browser only".

## 24. AI Recipe Assistant (chat.ts, ChatPanel)
* Uses the artifact **`sample`** capability (the viewer's own Claude usage; consent on first use),
  `modelTier: "default"`, with **page tools**:
  `list_recipes`, `get_recipe(id|"draft")`, `analyze_recipe(base_id|"draft"|"new", changes)` (dry run),
  `create_recipe(recipe, note)` (new lineage, v1), `edit_recipe(base_id, changes, note)` (**saves a copy
  as the next version; the base is never modified**).
* **Spec format for the AI (`RecipeSpec`):** compact, metric, catalog ids only. `applySpec` validates
  every id and number and throws readable errors listing valid ids, which the model sees and corrects.
* **Instructions** (a leading user turn, under 16 KB): rules (never overwrite, check with
  analyze_recipe, fix error flags, keep doses typical–bold, metric in tools, user's units in replies,
  brief phone-friendly answers, quote the tools' ABV), the open draft's spec and numbers, and the full
  catalog with dose bands.
* UI: streaming replies, Stop, live tool status, "saved vN" cards with Open, suggestion chips, error
  copy per error code. Fatal codes hide the feature; tools-unavailable falls back to text-only. Outside
  Claude the panel explains that the assistant runs inside Claude.
