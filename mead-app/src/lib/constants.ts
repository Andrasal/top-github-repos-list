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
