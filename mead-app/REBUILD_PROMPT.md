You are a senior full-stack engineer, a fermentation chemist and a professional meadmaker. Build **Mead Lab**, a professional mead recipe app I can sell. Work in the phases below. Finish each phase completely (code, tests, spec update, commit) before starting the next, and give me a short summary at each checkpoint.

## Ground rules (apply to every phase)
- **Spec first.** Before writing code, create `mead_app_spec.md` as the single source of truth: every formula, constant, data shape, rule and citation. Change the spec first, then the code. Tag each constant in code with `// SPEC §x.y` and a source id.
- **Pure math core.** All calculation lives in `src/lib` as pure TypeScript with no React or DOM, unit-tested with Vitest. The UI never does maths. All maths runs in SI units; unit conversion happens only at the UI boundary.
- **Skeptic pass.** After each phase, audit your own work as a hostile reviewer. Check the physics with worked numbers, look for edge cases (zero water, dry sugar only, huge doses, extreme pH), and write tests that would have caught each bug you find. Record the findings in the spec.
- **Cite everything.** Keep a citation registry (`sources.ts`) of id, citation, licence and how we use it. Show a "Sources" drawer and a "Show proof" panel for formulas.
- **Copyright.** Re-implement formulas and facts in our own code and words. Never copy third-party text, tables or code. Check each source's licence or terms. Where use is restricted (BJCP, TOSNA, Mead Made Right), use only the logic, credit it by name, and don't claim conformance.
- **Mobile first.** Make it work at 390 px width. Use plain language. Support dark mode.
- **Commits.** Commit with clear messages at the end of each phase.

## Stack
React 18 + TypeScript + Vite + Tailwind CSS v3. Units are metric by default with an Imperial toggle (US gal, lb, oz), which changes the display only. Data is a local JSON database in `src/data` (honeys, fruits, botanicals, yeasts, pairings), and every row cites a source. Also produce a single-file HTML build (`npm run build:single`).

## Phase 1 — Core maths
1. **Constants and units.**
   - Water 0.99820 kg/L at 20 °C; ethanol 0.794 g/mL; honey density 1.42 kg/L.
   - Derive the honey extract from its density by inverting the Lincoln equation (E ≈ 0.797, about 36.5 PPG). Don't use raw 82 % solids, which overstate it at about 37.9 PPG.
   - Use exact gal/lb/oz factors. PKL and PPG: PPG = PKL × 0.119826.
2. **Gravity.**
   - Lincoln equation: `SG = 1 + P/(258.6 − (P/258.2)·227.1)`.
   - Use its exact algebraic inverse so the round trip never drifts.
   - Blend liquids by mass.
3. **ABV.** Use only the Alternative equation: `ABV = [76.08(OG−FG)/(1.775−OG)]·[FG/0.794]` (Hall, Zymurgy 1995; Balling stoichiometry).
   - The linear 131.25 rule may appear only as a labelled comparison in the proof panel.
   - Domain is 1.000 ≤ OG < 1.775 and 0.980 ≤ FG ≤ OG; outside it, throw typed errors.
   - Test these benchmarks: 1.050/1.010 → 5.3394, 1.090/0.996 → 13.0962, 1.100/1.000 → 14.1954, 1.120/1.000 → 17.5546, 1.130/1.010 → 18.0050, 1.150/1.020 → 20.3289.
   - Provide an inverse `fgForAbv` by bisection.
4. **Must solver (mass balance, never additive volumes).**
   - Honey, sugar and fruit contribute dissolved solids and liquid mass. Fruit releases juice, which **replaces** water; it also has insoluble pulp.
   - Solve for the water needed to hit a target volume by bisection. Support a fixed-water mode too.
   - Flag over-volume. Handle the dry-sugar-only edge case with a solid-phase branch.
   - Report per-ingredient gravity contribution in PKL and PPG.
   - Fermenter occupancy: day 0 and after breakdown, with 20 % headspace, or 30 % when fruit is in primary.
   - Recovered volume after racking: fruit retention 0.15 L/kg plus 5 % lees loss.
   - Secondary fruit is excluded from the measured OG but included in an "effective OG" for ABV. Lighter juice dilutes.
   - Benchmark: 10 L target with 3 kg strawberries and 3 kg honey needs about 2.75 L less water, about 10.1 L day-0 occupancy and a fermenter of at least 13 L. Sanity check: 1 lb honey in 1 gal gives OG ≈ 1.035–1.037.
5. **Fermentation.**
   - Predict FG: dry at 0.996, or where the yeast's alcohol tolerance stops it, or a user target FG.
   - Sweetness: dry ≤ 1.006, semi-sweet ≤ 1.015, sweet ≤ 1.025, dessert above that.
   - Residual sugar = (FG − 0.996)·1000·2.6 g/L.
   - Strength: hydromel, standard or sack, using traditional terms and our own thresholds.
   - Sugar breaks at ⅓ and ½.
6. **Nutrients.**
   - YAN = Brix × 10 × demand factor (0.75 / 0.90 / 1.25 / 1.50).
   - Three protocols, each in 4 equal doses at 24, 48 and 72 h, and the ⅓ break or day 7, whichever comes first:
     - TOSNA 3.0: Fermaid O only, counted as 160 mg/L YAN per g/L;
     - Fermaid K + DAP: DAP only in doses 1–3;
     - O→K hybrid.
   - Go-Ferm at 1.25 × yeast mass.
   - Guard rails: DAP ≤ 0.968 g/L (US 27 CFR 24.246); no DAP after the ⅓ break or 9 % ABV; warn above 400 ppm YAN.
7. **Flavour engine.** A deterministic `advise()` returning advisories with `{id, severity, category, title, detail, suggestion, source[]}`. It covers:
   - fruit load bands;
   - TA estimate and target by sweetness;
   - tannin and structure;
   - a thin-finish detector;
   - high gravity and yeast tolerance;
   - spice dose bands, flagging subtle / typical / bold / max, "astronomically high" and "check units" above 3 × max;
   - combined spice intensity;
   - pairings;
   - honey varietal character.
8. **UI.**
   - Batch and yeast, fermentables, fruit, botanicals, results, nutrients and advisor panels.
   - An ABV proof panel and a calculator for measured readings.
   - A sources drawer.

## Phase 2 — Sulfite, export, licensing
1. **SO₂.**
   - Molecular fraction = 1/(1+10^(pH−pKa)).
   - Use the OIV apparent pKa by alcohol, interpolated linearly: 0 % 1.723, 5 % 1.819, 10 % 1.916, 15 % 2.014, 20 % 2.114.
   - Free SO₂ needed for 0.8 mg/L molecular (0.5 for tannic meads), with 25 % binding.
   - Doses for K-meta (÷0.5763), Na-meta (÷0.6740), Campden tablets (0.44 g) and a 10 % stock solution.
   - Free, total and bound SO₂ after the addition.
   - Sorbate at 0.2 g/L, only ever with SO₂.
   - Limits: US 350 mg/L total; EU 200 mg/L; US sulfite label at 10 mg/L; US sorbic acid 300 mg/L.
2. **Excel / Google Sheets export** using ExcelJS (MIT), lazy-loaded, with **live formulas**.
   - Sheets: Read me, Summary, Ingredients, Nutrients, Acidity, Sulfite, Advisor, Log, Sources.
   - Measured OG/FG input cells drive ABV, sweetness, residual sugar and breaks.
   - Dropdowns for protocol, yeast nitrogen demand, SO₂ product and sorbate.
   - Dose bands as formulas.
   - Every column named and every unit shown. Data validation, cell notes, conditional colours, print setup.
   - Also a "Copy for Google Sheets" tab-separated summary.
   - **Verify:** zero every cached value, recalculate in headless LibreOffice, and require every formula cell to match the app within 1e-6. Then edit inputs in the sheet and compare with the app's own analysis of the same change. Keep both as permanent tests.
3. **Licensing audit.** Check every source's terms, record the licence and usage in `sources.ts`, and show them in the app and the export.

## Phase 3 — Flow and fun
- **Flags on demand.** Warnings never interrupt editing. A "Check recipe" button shows every flag with a quiet count. Inline, show only neutral or positive information.
- **Dose meters for every fruit, flower, herb and spice, each on its own scale.**
  - Fruit is measured in kg/L. 0.3 kg/L is bold for raspberry but subtle for blueberry.
  - Add florals and herbs: elderflower, meadowsweet, orange blossom, jasmine, butterfly pea, linden, calendula, rosehip, heather, mint, thyme, hibiscus. Give each a flavour weight and, where relevant, an acid contribution.
- **Fun features:**
  - a flavour radar on 9 axes;
  - a generated tasting note;
  - a predicted glass colour;
  - a bottle count;
  - "hit a target" (choose ABV and finish, and it solves the honey);
  - batch scaling;
  - 10 style presets, each with zero error flags;
  - a batch log (pitch timer, nutrient timeline, gravity chart, live ABV, stuck or finished detection).
- **Performance.** Analyse on `useDeferredValue`. Load heavy libraries lazily.

## Phase 4 — pH audit and model
Audit the pH maths against many published sources: FDA "Approximate pH of Foods", Clemson Extension, White 1962 (USDA), the OIV, Pereira 2015 and the American Homebrewers Association water study. Then replace any rule of thumb with an **acid–base charge-balance model**:
- **Weak acids:** pKa values from the CRC, with a Davies activity correction.
- **Fruit:** rebuilt from each fruit's measured juice pH and TA.
- **Honey:** gluconic acid. Darker honeys get more acidity.
- **Water:** alkalinity acts as base.
- **Fermentation acids:** succinic, acetic, and cation uptake by yeast.
- **Additions:** acids and buffers (tartaric, malic, citric, lactic, KHCO₃, K₂CO₃, CaCO₃).
- **Calibration:** fit to published must and finished pH (target RMS ≈ 0.02) and freeze it in tests.

Outputs:
- must and finished pH and TA;
- each ingredient's effect on pH;
- a pH-versus-dose curve per fruit;
- the dose of acid or buffer needed to reach a target pH;
- the predicted pH feeding the SO₂ calculation, overridable with a measured reading.

## Phase 5 — Recipe library and AI assistant
1. **Versioned library.**
   - Saved recipes are never overwritten. Opening one gives an editable copy. Saving creates v2, v3… in the same lineage, or "save as new recipe".
   - Warn about unsaved changes when switching.
   - Test that the parent is byte-identical after deriving a new version.
2. **AI chat that creates and edits recipes through tools.** Every edit saves a **new version**; the original is kept.
   - Tools: `list_recipes`, `get_recipe`, `analyze_recipe` (a dry run), `create_recipe` and `edit_recipe` (saves a copy).
   - The AI works with a compact metric recipe spec using catalog ids only. Validate it strictly, with readable errors listing the valid ids.
   - System instructions:
     - check numbers with `analyze_recipe` before saving;
     - fix error flags;
     - keep doses between typical and bold;
     - quote the app's ABV rather than its own;
     - reply briefly for phone users.
   - UI: streaming replies, Stop, live tool status, "saved vN" cards with Open, suggestion chips.
3. **Resilience.**
   - Plain JSON Schema only: no union types, under 4 KB per tool.
   - If tool calling fails before anything was shown or saved, fall back once to a JSON mode, `{reply, action: none|create|edit, base_id, note, changes}`, which the page validates and saves itself.
   - Show the real error code under "Details" with a "Try again" button.

## Phase 6 — Export double-check
Audit the export again as a stranger opening it: missing names, unlabelled values, frozen values that should be live, inputs rounded too early. Fix everything and extend the recalculation tests.

## Phase 7 — Make it sellable: bring your own AI
- **Locked by default.** The AI assistant is locked (🔒 on the button, plus a "Connect your AI to unlock" screen) until the subscriber connects an AI. Everything else works without one.
- **Explain the plans on screen.** Chat-app plans (Claude.ai, ChatGPT, the Gemini app) can't be linked to other apps; every option needs an API key, and several are free.
- **Provider picker:**
  - Google Gemini — free tier, key from aistudio.google.com;
  - Claude (Anthropic) — pay per use;
  - OpenRouter — free `:free` models and paid models;
  - OpenAI;
  - Groq;
  - Mistral;
  - Ollama — local, free;
  - any OpenAI-compatible API (base URL plus key).
- **Claude path.** Use the official `@anthropic-ai/sdk` in the browser with the latest Claude Opus model. Use a streaming manual tool loop with adaptive thinking and medium effort, and turn on server-side refusal fallbacks (retry once without them if the account rejects the beta). Set eager input streaming on each tool, which means:
  - validate every tool input against its schema before running it, and return an `INVALID_JSON` error result if it fails;
  - never run tools on `refusal` or on `max_tokens` with a tool call.

  Map SDK errors by class (401 bad key, 402 billing, 429 rate limited, 529 overloaded, network, abort).
- **Everyone else.** Use one Chat Completions tool loop.
  - Echo the assistant turn back unchanged (this keeps Gemini's thought signatures).
  - Every tool needs at least one parameter, because Gemini rejects empty ones.
  - Hide `<think>` text.
  - Read errors hidden inside 200 responses (OpenRouter).
  - Fall back to JSON mode for models without function calling.
- **Connecting.** Check the key by listing models. Pick a sensible default model (e.g. the newest Gemini Flash, `openrouter/free`) and offer a model picker in AI settings.
- **Key handling.**
  - The key stays in the browser and goes only to the provider. Store it in localStorage only when "Remember on this device" is ticked, otherwise sessionStorage.
  - Show it masked, with a Disconnect button.
  - On screen, warn about free-tier limits and data use. Note that Google's terms require its paid tier when serving users in the EU, UK and Switzerland.
- **Tests.** Write unit tests with mocked clients and fetch, plus Playwright end-to-end tests with mocked provider endpoints: bad key, good key, a tool edit saving v2 with the original kept, a no-tools model in JSON mode, and disconnect.
- **Selling checklist** in the spec: static hosting, payments (Stripe, Paddle or Lemon Squeezy), accounts and cloud recipe storage, privacy policy, terms, and the licence notes.

## Optional: publishing as a Claude artifact
If the app also runs as a Claude artifact:
- Inside Claude, use the `sample` capability as the AI.
- Store the library through the `db` and `user` capabilities in the viewer's private subtree. Paths must alternate collection and document: `data/users/<id>/meadlab/recipes/<entryId>`.
- Offer the export file through the `downloads` capability.
- Load ExcelJS from a pinned CDN version.

Outside AI services are blocked inside artifacts, so bring-your-own-key works only in the hosted build.

## Definition of done
- All tests pass, including the formula benchmarks, the 3 kg strawberry audit, LibreOffice recalculation, the pH calibration and the AI loops.
- `npm run build` and `npm run build:single` succeed.
- The spec matches the code.
- Each phase ends with a short summary of what was built, what the skeptic pass caught, and anything I need to decide.
