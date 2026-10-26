# 🍯 Mead Lab

A professional mead recipe builder, calculator and flavor advisor. React + TypeScript + Tailwind, with a pure, unit-tested math core.

**Source of truth:** [`mead_app_spec.md`](./mead_app_spec.md). It holds every formula, constant, rule and citation. Code comments point back to it with `SPEC §x.y` tags.

## Features
- **Alternative ABV equation** (Hall, 1995): `[76.08·(OG−FG)/(1.775−OG)]·[FG/0.794]`, with a step-by-step **Show proof** panel and citations.
- **Mass-balance must solver**: solves for the water needed to hit the target volume, accounts for fruit-juice displacement and fermenter occupancy, and reports each ingredient's gravity contribution in PKL/PPG.
- **YAN and SNA**: works out the nitrogen requirement from Brix × yeast demand; TOSNA 3.0, Fermaid K+DAP and hybrid schedules; Go-Ferm rehydration; legal-limit and timing guard rails.
- **Mead Maker's Brain**: advice on fruit load, acid balance, tannin/structure, thin-finish detection, high-gravity and yeast-tolerance warnings, spice dose bands (up to "astronomically high"), and pairing ideas.
- **Sulfite**: free, molecular and total SO₂ worked out from pH; K-meta, Na-meta, Campden or stock-solution doses; binding allowance; potassium sorbate for back-sweetening; US and EU legal limits.
- **Export**: a styled Excel workbook with live formulas (opens in Google Sheets), plus a copy-and-paste summary for Sheets.
- **Source licensing audit**: every source shows its licence status and how it is used.
- **Check recipe**: warnings stay out of the way until you ask; one button shows every flag.
- **Dose meters** for every fruit, flower, herb and spice, each on its own intensity scale.
- **Flavour radar, tasting note and glass colour** predicted from the recipe.
- **Hit a target**: choose an ABV and a finish, and it solves the honey. Also **batch scaling** and **10 style presets**.
- **Batch log**: pitch timer, nutrient timeline, gravity chart, live ABV, and stuck/finished detection.
- **Recipe library with versions**: saved recipes are never overwritten. Opening one gives you a copy and saving creates v2, v3… Synced to your Claude account when opened in Claude.
- **AI recipe assistant**: describe a mead or a change and Claude designs or edits it, always saving a new version.
- Metric by default, with an Imperial switch. A local JSON database of honeys, fruits, spices and yeasts, each row citing its source.

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest — 125 tests (incl. LibreOffice recalculation of the Excel export)
npm run build
npm run build:single   # one self-contained HTML file
```
