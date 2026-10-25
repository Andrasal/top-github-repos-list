/**
 * Citation registry — SPEC §9.
 * Every constant, formula and database row references one or more of these ids.
 */
export interface Source {
  id: string;
  short: string;
  citation: string;
  url?: string;
  note?: string;
}

export const SOURCES: Record<string, Source> = {
  'hall-1995': {
    id: 'hall-1995',
    short: 'Hall (1995)',
    citation: 'Hall, M. L. "Brew by the Numbers — Add Up What\'s in Your Beer." Zymurgy, Summer 1995.',
    note: 'Origin of the non-linear ABW term 76.08·(OG−FG)/(1.775−OG) and the ABW→ABV density conversion (FG/0.794).',
  },
  'brewersfriend-abv': {
    id: 'brewersfriend-abv',
    short: "Brewer's Friend",
    citation: "Brewer's Friend, ABV Calculator — \"Alternate Formula\" recommended for high-gravity beverages.",
    url: 'https://www.brewersfriend.com/abv-calculator/',
  },
  balling: {
    id: 'balling',
    short: 'Balling (1865)',
    citation: 'Balling, C. J. N. Die Gährungschemie. Prague, 1865. Stoichiometry: 2.0665 g extract → 1 g ethanol + 0.9565 g CO₂ + 0.11 g yeast.',
  },
  lincoln: {
    id: 'lincoln',
    short: 'Lincoln eq.',
    citation: 'Lincoln equation: SG = 1 + P / (258.6 − (P/258.2)·227.1), the standard Plato ⇄ SG approximation in brewing software.',
  },
  asbc: {
    id: 'asbc',
    short: 'ASBC',
    citation: 'American Society of Brewing Chemists, Methods of Analysis — Table 1: Extract in Wort and Beer.',
  },
  'crc-water': {
    id: 'crc-water',
    short: 'CRC (water)',
    citation: 'CRC Handbook of Chemistry and Physics — Density of water as a function of temperature (0.99820 g/mL at 20 °C).',
  },
  'crc-sucrose': {
    id: 'crc-sucrose',
    short: 'CRC (sucrose)',
    citation: 'CRC Handbook of Chemistry and Physics — physical constants of organic compounds (sucrose 1.587 g/cm³).',
  },
  'nhb-honey': {
    id: 'nhb-honey',
    short: 'National Honey Board',
    citation: 'National Honey Board, "Honey: Composition and Properties" — average moisture 17.2 %, density ≈ 1.42 kg/L.',
    url: 'https://honey.com',
  },
  'white-1975': {
    id: 'white-1975',
    short: 'White (1975)',
    citation: 'White, J. W. "Composition of Honey." In Crane, E. (ed.), Honey: A Comprehensive Survey. Heinemann, 1975.',
  },
  'usda-fdc': {
    id: 'usda-fdc',
    short: 'USDA FDC',
    citation: 'USDA FoodData Central — fruit sugar and moisture composition.',
    url: 'https://fdc.nal.usda.gov',
  },
  tosna: {
    id: 'tosna',
    short: 'TOSNA 3.0',
    citation: 'Moutela, S. TOSNA 3.0 — Tailored Organic Staggered Nutrient Additions.',
    url: 'https://www.tosna.org',
    note: 'Fermaid O only; four equal additions at 24 h, 48 h, 72 h and the 1/3 sugar break (or day 7). Organic N treated as ~4× as effective.',
  },
  'scott-handbook': {
    id: 'scott-handbook',
    short: 'Scott Labs Handbook',
    citation: 'Scott Laboratories, Fermentation Handbook (annual) — nutrient YAN contributions, yeast nitrogen classes, Go-Ferm rehydration.',
    url: 'https://scottlab.com',
  },
  meadmaderight: {
    id: 'meadmaderight',
    short: 'Mead Made Right',
    citation: 'Mead Made Right — YAN requirement (Brix × 10 × nitrogen-demand factor) and nutrient practice.',
    url: 'https://meadmaderight.com',
  },
  'ttb-24-246': {
    id: 'ttb-24-246',
    short: '27 CFR 24.246',
    citation: '27 CFR § 24.246 — Materials authorized for the treatment of wine and juice (DAP ≤ 8 lb/1000 gal ≈ 0.968 g/L).',
    url: 'https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-24/subpart-L/section-24.246',
  },
  'bjcp-2015': {
    id: 'bjcp-2015',
    short: 'BJCP 2015',
    citation: 'Beer Judge Certification Program, 2015 Mead Style Guidelines — strength (hydromel/standard/sack) and sweetness levels.',
    url: 'https://www.bjcp.org',
  },
  schramm: {
    id: 'schramm',
    short: 'Schramm (2003)',
    citation: 'Schramm, K. The Compleat Meadmaker. Brewers Publications, 2003.',
  },
  piatz: {
    id: 'piatz',
    short: 'Piatz (2014)',
    citation: 'Piatz, S. The Complete Guide to Making Mead. Voyageur Press, 2014.',
  },
  zoecklein: {
    id: 'zoecklein',
    short: 'Zoecklein et al.',
    citation: 'Zoecklein, B., Fugelsang, K., Gump, B., Nury, F. Wine Analysis and Production. Springer — TA/pH and acid equivalence factors.',
  },
  practice: {
    id: 'practice',
    short: 'Practice',
    citation: 'Practitioner consensus and commercial meadery practice. Treat as guidance to verify with bench trials, not as law.',
  },
};

export function getSource(id: string): Source {
  const s = SOURCES[id];
  if (!s) throw new Error(`Unknown source id: ${id}`);
  return s;
}
