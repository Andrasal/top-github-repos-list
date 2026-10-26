/** Physical & enological constants — SPEC §2. Every value is tagged with its spec section and source id. */

// §2.1 Physical
export const RHO_WATER_20C = 0.9982; // kg/L — SPEC §2.1 — crc-water
export const RHO_ETHANOL = 0.794; // g/mL — SPEC §2.1/§4 — hall-1995
export const RHO_HONEY_DEFAULT = 1.42; // kg/L — SPEC §2.1 — nhb-honey, white-1975
export const RHO_HONEY_RANGE: [number, number] = [1.38, 1.45]; // SPEC §2.1
export const HONEY_SOLIDS_DEFAULT = 0.82; // fraction — SPEC §2.1 — nhb-honey
export const RHO_SUCROSE_SOLID = 1.587; // kg/L — SPEC §2.1 — crc-sucrose
export const RHO_FRUIT_WHOLE = 1.05; // kg/L — SPEC §2.1 — practice
export const RHO_FRUIT_INSOLUBLE = 1.3; // kg/L — SPEC §2.1 — practice

// §2.2 Enological
export const DRY_FG_DEFAULT = 0.996; // SPEC §2.2 — practice
export const POINTS_TO_RS = 2.6; // g/L per gravity point — SPEC §2.2 — practice
export const FERMAID_O_YAN_LABEL = 40; // mg N/L per g/L — SPEC §2.2 — scott-handbook
export const ORGANIC_N_MULTIPLIER = 4; // SPEC §2.2 — tosna
export const FERMAID_O_YAN_EFFECTIVE = FERMAID_O_YAN_LABEL * ORGANIC_N_MULTIPLIER; // 160
export const FERMAID_K_YAN = 100; // mg N/L per g/L — SPEC §2.2 — scott-handbook
export const DAP_YAN = 210; // mg N/L per g/L — SPEC §2.2 — scott-handbook
export const GOFERM_RATIO = 1.25; // g per g yeast — SPEC §2.2 — scott-handbook, tosna
export const GOFERM_WATER_RATIO = 20; // g water per g Go-Ferm — SPEC §7.2
export const DAP_LEGAL_MAX = 0.968; // g/L — SPEC §2.2 — ttb-24-246
export const DAP_ABV_CUTOFF = 9; // % ABV — SPEC §2.2 — scott-handbook
export const FERMAID_K_DOSE_MAX = 0.5; // g/L per addition — SPEC §7.3

// §5.3 Displacement & yield
export const HEADSPACE_TRADITIONAL = 0.2; // SPEC §5.3
export const HEADSPACE_FRUIT = 0.3; // SPEC §5.3
export const LEES_LOSS_FRACTION = 0.05; // SPEC §5.3
export const FRUIT_RETENTION_DEFAULT = 0.15; // L/kg — SPEC §5.3

// §7.1 YAN demand factors — scott-handbook, tosna, meadmaderight
export type NDemand = 'low' | 'medium' | 'high' | 'veryHigh';
export const YAN_FACTORS: Record<NDemand, number> = { low: 0.75, medium: 0.9, high: 1.25, veryHigh: 1.5 };

// §8.2 acid equivalence to tartaric — zoecklein (ratio of equivalent weights 75.04 / x)
export const ACID_TO_TARTARIC = { tartaric: 1.0, malic: 75.04 / 67.04, citric: 75.04 / 64.04 } as const;
export type AcidType = keyof typeof ACID_TO_TARTARIC;
export const HONEY_BASE_TA = 0.5; // g/L tartaric eq. — SPEC §8.2 — practice

// §13 Sulfite chemistry — margalit, zoecklein, usseglio
export const SO2_PKA1 = 1.81; // SPEC §13.1 — pKa1 of SO2·H2O ⇄ HSO3⁻ at 20 °C (aqueous)
export const MW_SO2 = 64.066; // g/mol
export const MW_KMETA = 222.32; // K2S2O5 g/mol
export const MW_NAMETA = 190.1; // Na2S2O5 g/mol
export const KMETA_SO2_FRACTION = (2 * MW_SO2) / MW_KMETA; // 0.5763 — SPEC §13.2
export const NAMETA_SO2_FRACTION = (2 * MW_SO2) / MW_NAMETA; // 0.6740
export const CAMPDEN_KMETA_G = 0.44; // g K-meta per tablet (typical US) — SPEC §13.2 — practice
export const KMETA_STOCK_PCT = 10; // % w/v stock solution — SPEC §13.2
export const SO2_LIMIT_US_TOTAL = 350; // mg/L — 27 CFR 4.22(b)(1) — ttb-4-22
export const SO2_LIMIT_EU_MEAD = 200; // mg/L total — Reg (EC) 1333/2008 Annex II cat. 14.2.5 — eu-1333
export const SO2_LABEL_THRESHOLD = 10; // mg/L total → "Contains sulfites" — 27 CFR 4.32(e) — ttb-4-32
export const MOLECULAR_SO2_SENSORY = 1.5; // mg/L — above this SO2 becomes perceptible — margalit
export const MW_SORBIC = 112.13;
export const MW_KSORBATE = 150.22;
export const SORBIC_FRACTION_OF_KSORBATE = MW_SORBIC / MW_KSORBATE; // 0.7464
export const SORBATE_DOSE_GPL = 0.2; // g/L potassium sorbate (~150 mg/L sorbic acid) — practice
export const SORBIC_LIMIT_US = 300; // mg/L sorbic acid — 27 CFR 24.246 — ttb-24-246
