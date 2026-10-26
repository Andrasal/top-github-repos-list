/**
 * Citation registry — SPEC §9.
 * Every constant, formula and database row references one or more of these ids.
 */
/**
 * Licensing audit — SPEC §15. Formulas, methods and numeric facts are not copyrightable
 * (US 17 U.S.C. §102(b); Feist v. Rural, 1991). We never copy prose, tables or documents verbatim:
 * every formula and protocol here is re-implemented from its underlying logic and attributed.
 */
export type LicenseStatus =
  | 'public-domain' // government works / CC0 — free to use, credit requested
  | 'open-reuse' // reuse permitted with attribution (e.g. EUR-Lex)
  | 'facts-attributed' // copyrighted publication; we use only facts/formulas, re-derived and cited
  | 'logic-only' // terms restrict reuse or are unknown → independent implementation, no content reproduced
  | 'own'; // our own estimates/practice

export interface Source {
  id: string;
  short: string;
  citation: string;
  url?: string;
  note?: string;
  license: LicenseStatus;
  usage: string;
}

export const SOURCES: Record<string, Source> = {
  'hall-1995': {
    id: 'hall-1995',
    license: 'facts-attributed',
    usage: 'Formula only (a mathematical relation, not copyrightable). Re-implemented and cited; no article text reproduced.',
    short: 'Hall (1995)',
    citation: 'Hall, M. L. "Brew by the Numbers — Add Up What\'s in Your Beer." Zymurgy, Summer 1995.',
    note: 'Origin of the non-linear ABW term 76.08·(OG−FG)/(1.775−OG) and the ABW→ABV density conversion (FG/0.794).',
  },
  'brewersfriend-abv': {
    id: 'brewersfriend-abv',
    license: 'facts-attributed',
    usage: 'Cited as the popular reference for the formula. No code, text or UI copied; the formula originates with Hall (1995).',
    short: "Brewer's Friend",
    citation: "Brewer's Friend, ABV Calculator — \"Alternate Formula\" recommended for high-gravity beverages.",
    url: 'https://www.brewersfriend.com/abv-calculator/',
  },
  balling: {
    id: 'balling',
    license: 'public-domain',
    usage: '1865 publication, long out of copyright. Stoichiometric ratios used.',
    short: 'Balling (1865)',
    citation: 'Balling, C. J. N. Die Gährungschemie. Prague, 1865. Stoichiometry: 2.0665 g extract → 1 g ethanol + 0.9565 g CO₂ + 0.11 g yeast.',
  },
  lincoln: {
    id: 'lincoln',
    license: 'facts-attributed',
    usage: 'Equation only; widely published relation. Re-implemented with an exact algebraic inverse.',
    short: 'Lincoln eq.',
    citation: 'Lincoln equation: SG = 1 + P / (258.6 − (P/258.2)·227.1), the standard Plato ⇄ SG approximation in brewing software.',
  },
  asbc: {
    id: 'asbc',
    license: 'facts-attributed',
    usage: 'Used only to check accuracy. The ASBC table itself is not reproduced.',
    short: 'ASBC',
    citation: 'American Society of Brewing Chemists, Methods of Analysis — Table 1: Extract in Wort and Beer.',
  },
  'crc-water': {
    id: 'crc-water',
    license: 'facts-attributed',
    usage: 'Physical constants (facts) only.',
    short: 'CRC (water)',
    citation: 'CRC Handbook of Chemistry and Physics — Density of water as a function of temperature (0.99820 g/mL at 20 °C).',
  },
  'crc-sucrose': {
    id: 'crc-sucrose',
    license: 'facts-attributed',
    usage: 'Physical constant (fact) only.',
    short: 'CRC (sucrose)',
    citation: 'CRC Handbook of Chemistry and Physics — physical constants of organic compounds (sucrose 1.587 g/cm³).',
  },
  'nhb-honey': {
    id: 'nhb-honey',
    license: 'facts-attributed',
    usage: 'Average composition figures (facts) only.',
    short: 'National Honey Board',
    citation: 'National Honey Board, "Honey: Composition and Properties" — average moisture 17.2 %, density ≈ 1.42 kg/L.',
    url: 'https://honey.com',
  },
  'white-1975': {
    id: 'white-1975',
    license: 'facts-attributed',
    usage: 'Composition figures (facts) only.',
    short: 'White (1975)',
    citation: 'White, J. W. "Composition of Honey." In Crane, E. (ed.), Honey: A Comprehensive Survey. Heinemann, 1975.',
  },
  'usda-fdc': {
    id: 'usda-fdc',
    license: 'public-domain',
    usage: 'Public domain under CC0 1.0. Credit to FDC requested and given. Our fruit rows are our own rounded estimates informed by FDC.',
    short: 'USDA FDC',
    citation: 'USDA FoodData Central — fruit sugar and moisture composition.',
    url: 'https://fdc.nal.usda.gov',
  },
  tosna: {
    id: 'tosna',
    license: 'logic-only',
    usage: 'The original site no longer resolves and no license could be found. The method (four equal organic-nutrient additions at 24 h, 48 h, 72 h and the ⅓ break) is implemented independently from its published logic and attributed by name. No text or calculator code reproduced.',
    short: 'TOSNA 3.0',
    citation: 'Moutela, S. TOSNA 3.0 — Tailored Organic Staggered Nutrient Additions.',
    url: 'https://www.tosna.org',
    note: 'Fermaid O only; four equal additions at 24 h, 48 h, 72 h and the 1/3 sugar break (or day 7). Organic N treated as ~4× as effective.',
  },
  'scott-handbook': {
    id: 'scott-handbook',
    license: 'facts-attributed',
    usage: 'Copyrighted handbook. Only numeric facts are used (YAN per g/L, rehydration ratio). Fermaid®, Go-Ferm® and Lalvin® are Lallemand trademarks, used here only to name the products.',
    short: 'Scott Labs Handbook',
    citation: 'Scott Laboratories, Fermentation Handbook (annual) — nutrient YAN contributions, yeast nitrogen classes, Go-Ferm rehydration.',
    url: 'https://scottlab.com',
  },
  meadmaderight: {
    id: 'meadmaderight',
    license: 'logic-only',
    usage: 'Terms of use could not be verified. Only the general Brix × 10 × demand-factor relation (common industry practice) is used; no content reproduced.',
    short: 'Mead Made Right',
    citation: 'Mead Made Right — YAN requirement (Brix × 10 × nitrogen-demand factor) and nutrient practice.',
    url: 'https://meadmaderight.com',
  },
  'ttb-24-246': {
    id: 'ttb-24-246',
    license: 'public-domain',
    usage: 'US federal regulation, public domain.',
    short: '27 CFR 24.246',
    citation: '27 CFR § 24.246 — Materials authorized for the treatment of wine and juice (DAP ≤ 8 lb/1000 gal ≈ 0.968 g/L).',
    url: 'https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-24/subpart-L/section-24.246',
  },
  'bjcp-2015': {
    id: 'bjcp-2015',
    license: 'logic-only',
    usage: 'BJCP terms require permission and an in-app notice for apps using its guidelines, so this app does not reproduce or claim BJCP guidelines. Strength and sweetness classes use traditional mead terms with our own thresholds. BJCP is linked for further reading only.',
    short: 'BJCP 2015',
    citation: 'Beer Judge Certification Program, 2015 Mead Style Guidelines — strength (hydromel/standard/sack) and sweetness levels.',
    url: 'https://www.bjcp.org',
  },
  schramm: {
    id: 'schramm',
    license: 'facts-attributed',
    usage: 'Book, copyrighted. Only general dosing guidance (facts and ranges) informs our own bands; no text reproduced.',
    short: 'Schramm (2003)',
    citation: 'Schramm, K. The Compleat Meadmaker. Brewers Publications, 2003.',
  },
  piatz: {
    id: 'piatz',
    license: 'facts-attributed',
    usage: 'Book, copyrighted. Only general guidance informs our own bands; no text reproduced.',
    short: 'Piatz (2014)',
    citation: 'Piatz, S. The Complete Guide to Making Mead. Voyageur Press, 2014.',
  },
  zoecklein: {
    id: 'zoecklein',
    license: 'facts-attributed',
    usage: 'Textbook, copyrighted. Only chemical facts (equivalent weights, TA/pH relations) are used.',
    short: 'Zoecklein et al.',
    citation: 'Zoecklein, B., Fugelsang, K., Gump, B., Nury, F. Wine Analysis and Production. Springer — TA/pH and acid equivalence factors.',
  },
  practice: {
    id: 'practice',
    license: 'own',
    usage: 'Our own synthesis of common practice. No third-party content.',
    short: 'Practice',
    citation: 'Practitioner consensus and commercial meadery practice. Treat as guidance to verify with bench trials, not as law.',
  },
  margalit: {
    id: 'margalit',
    short: 'Margalit',
    citation: 'Margalit, Y. Concepts in Wine Chemistry, 3rd ed. Wine Appreciation Guild — SO₂ equilibria, molecular SO₂ targets, sensory threshold.',
    license: 'facts-attributed',
    usage: 'Chemical facts only (pKa 1.81, molecular-SO₂ relation). Re-derived; no text reproduced.',
  },
  usseglio: {
    id: 'usseglio',
    short: 'Usseglio-Tomasset',
    citation: 'Usseglio-Tomasset, L. & Bosia, P. D. (1984). Determination of the SO₂ dissociation constants in hydroalcoholic solutions. Vini d\'Italia.',
    license: 'facts-attributed',
    usage: 'Cited for the qualitative fact that ethanol raises the effective pKa. Only the caveat is used.',
  },
  'ttb-4-22': {
    id: 'ttb-4-22',
    short: '27 CFR 4.22',
    citation: '27 CFR § 4.22(b)(1) — wine containing more than 350 ppm total sulfur dioxide is not standard wine.',
    url: 'https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4/subpart-C/section-4.22',
    license: 'public-domain',
    usage: 'US federal regulation, public domain.',
  },
  'ttb-4-32': {
    id: 'ttb-4-32',
    short: '27 CFR 4.32(e)',
    citation: '27 CFR § 4.32(e) — "Contains sulfites" declaration when total SO₂ ≥ 10 ppm.',
    url: 'https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4/subpart-D/section-4.32',
    license: 'public-domain',
    usage: 'US federal regulation, public domain.',
  },
  'eu-1333': {
    id: 'eu-1333',
    short: 'EU 1333/2008',
    citation: 'Regulation (EC) No 1333/2008 on food additives, Annex II, food category 14.2.5 "Mead": sulphites (E 220–228) max 200 mg/L total SO₂.',
    url: 'https://eur-lex.europa.eu/eli/reg/2008/1333/oj',
    license: 'open-reuse',
    usage: 'EUR-Lex content may be reused with acknowledgement (Commission Decision 2011/833/EU). Limit value only.',
  },
};

export function getSource(id: string): Source {
  const s = SOURCES[id];
  if (!s) throw new Error(`Unknown source id: ${id}`);
  return s;
}
