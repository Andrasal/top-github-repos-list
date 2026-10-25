# 🍯 Mead Lab

A professional mead recipe builder, calculator and flavor advisor. React + TypeScript + Tailwind, with a pure, unit-tested math core.

**Source of truth:** [`mead_app_spec.md`](./mead_app_spec.md). It holds every formula, constant, rule and citation. Code comments point back to it with `SPEC §x.y` tags.

## Features
- **Alternative ABV equation** (Hall, 1995): `[76.08·(OG−FG)/(1.775−OG)]·[FG/0.794]`, with a step-by-step **Show proof** panel and citations.
- **Mass-balance must solver**: solves for the water needed to hit the target volume, accounts for fruit-juice displacement and fermenter occupancy, and reports each ingredient's gravity contribution in PKL/PPG.
- **YAN and SNA**: works out the nitrogen requirement from Brix × yeast demand; TOSNA 3.0, Fermaid K+DAP and hybrid schedules; Go-Ferm rehydration; legal-limit and timing guard rails.
- **Mead Maker's Brain**: advice on fruit load, acid balance, tannin/structure, thin-finish detection, high-gravity and yeast-tolerance warnings, spice dose bands (up to "astronomically high"), and pairing ideas.
- Metric by default, with an Imperial switch. A local JSON database of honeys, fruits, spices and yeasts, each row citing its source.

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest — 49 tests
npm run build
```
