/**
 * Acid–base equilibrium model — SPEC §22.
 * A must is a pool of weak organic acids (mol/L) plus strong-base cations (K⁺, Ca²⁺, Mg²⁺, NH₄⁺ … as eq/L).
 * pH is the root of the charge balance:   [H⁺] + cations = Σ Cᵢ·q̄ᵢ(pH) + [OH⁻]
 * where q̄ is an acid's mean negative charge at that pH. Dilution scales acids and cations
 * together, so a buffered juice keeps nearly its own pH when diluted — the reason pH does NOT blend linearly.
 * pKa values: 25 °C aqueous (CRC). Activity and ethanol corrections are ignored → ±0.1–0.2 pH.
 */
export type AcidId = 'tartaric' | 'malic' | 'citric' | 'gluconic' | 'succinic' | 'acetic' | 'lactic';

export const ACIDS: Record<AcidId, { mw: number; pka: number[] }> = {
  tartaric: { mw: 150.09, pka: [3.04, 4.37] },
  malic: { mw: 134.09, pka: [3.4, 5.11] },
  citric: { mw: 192.12, pka: [3.13, 4.76, 6.4] },
  gluconic: { mw: 196.16, pka: [3.86] },
  succinic: { mw: 118.09, pka: [4.21, 5.64] },
  acetic: { mw: 60.05, pka: [4.76] },
  lactic: { mw: 90.08, pka: [3.86] },
};
export const TARTARIC_EQ_WT = 75.04; // g per equivalent — TA is reported as tartaric acid
const KW = 1e-14;

export interface Pool { acids: Partial<Record<AcidId, number>>; cations: number }
export const emptyPool = (): Pool => ({ acids: {}, cations: 0 });

/**
 * Apparent (concentration) pKa at ionic strength I — Davies equation:
 *   pKa'_j = pKa_j − 2j·A·(√I/(1+√I) − 0.3·I),  A = 0.51 (25 °C).
 * Real musts sit near I ≈ 0.02–0.05; I = 0 gives the ideal textbook constants.
 */
export function apparentPka(acid: AcidId, I = 0): number[] {
  const f = I > 0 ? 0.51 * (Math.sqrt(I) / (1 + Math.sqrt(I)) - 0.3 * I) : 0;
  return ACIDS[acid].pka.map((p, j) => p - 2 * (j + 1) * f);
}

/** Mean negative charge per molecule of an acid at [H⁺] = h (ionic strength I). */
export function meanCharge(acid: AcidId, h: number, I = 0): number {
  const ka = apparentPka(acid, I).map((p) => 10 ** -p);
  // Terms of the speciation polynomial: hⁿ, hⁿ⁻¹K1, hⁿ⁻²K1K2, …
  const n = ka.length;
  const terms: number[] = [];
  let prod = 1;
  for (let j = 0; j <= n; j++) {
    if (j > 0) prod *= ka[j - 1];
    terms.push(h ** (n - j) * prod);
  }
  const sum = terms.reduce((a, b) => a + b, 0);
  return terms.reduce((a, t, j) => a + j * t, 0) / sum;
}

/** Solve the charge balance for pH (bisection; the residual is monotonic in pH). */
export function solvePh(pool: Pool, I = 0): number {
  const resid = (pH: number) => {
    const h = 10 ** -pH;
    let anions = KW / h;
    for (const [id, c] of Object.entries(pool.acids) as [AcidId, number][]) anions += c * meanCharge(id, h, I);
    return h + pool.cations - anions;
  };
  let lo = 0.5, hi = 12;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (resid(mid) > 0) lo = mid; else hi = mid; // residual falls as pH rises
  }
  return (lo + hi) / 2;
}

/** Titratable acidity to pH 8.2, as g/L tartaric. ≈ Σ nᵢCᵢ − cations (all listed pKas are below 8.2). */
export function titratableAcidity(pool: Pool): number {
  let eq = -pool.cations;
  for (const [id, c] of Object.entries(pool.acids) as [AcidId, number][]) eq += c * ACIDS[id].pka.length;
  return Math.max(0, eq) * TARTARIC_EQ_WT;
}

/**
 * Reconstruct a juice's acid/cation pool (per litre) from two measurements: its pH and its TA (g/L as `acid`).
 * Two linear equations in C (acid mol/L) and K (cation eq/L):
 *   charge balance at pH:  h + K = C·q̄ + Kw/h
 *   titration:             TA_eq = n·C − K
 */
export function poolFromJuice(acid: AcidId, pH: number, taGPerL: number, I = 0): Pool {
  const n = ACIDS[acid].pka.length;
  const h = 10 ** -pH;
  const q = meanCharge(acid, h, I);
  const taEq = taGPerL / (ACIDS[acid].mw / n);
  let C = (taEq - h + KW / h) / (n - q);
  let K = C * q - h + KW / h;
  if (K < 0) { // pH lower than this TA allows → treat as free acid only
    K = 0;
    C = taEq / n;
  }
  return { acids: { [acid]: Math.max(0, C) }, cations: K };
}

export function scalePool(p: Pool, k: number): Pool {
  const acids: Pool['acids'] = {};
  for (const [id, c] of Object.entries(p.acids) as [AcidId, number][]) acids[id] = c * k;
  return { acids, cations: p.cations * k };
}

export function addPools(...pools: Pool[]): Pool {
  const out = emptyPool();
  for (const p of pools) {
    for (const [id, c] of Object.entries(p.acids) as [AcidId, number][]) out.acids[id] = (out.acids[id] ?? 0) + c;
    out.cations += p.cations;
  }
  return out;
}

/** Free acid added as a solid: grams into `volumeL`. */
export const acidAddition = (acid: AcidId, grams: number, volumeL: number): Pool =>
  ({ acids: { [acid]: volumeL > 0 ? grams / ACIDS[acid].mw / volumeL : 0 }, cations: 0 });

/** Base added as a solid (consumes H⁺, CO₂ escapes): equivalents per gram. */
export const BASES = {
  kBicarb: { label: 'Potassium bicarbonate (KHCO₃)', eqPerG: 1 / 100.115 },
  kCarb: { label: 'Potassium carbonate (K₂CO₃)', eqPerG: 2 / 138.205 },
  caCarb: { label: 'Calcium carbonate (CaCO₃)', eqPerG: 2 / 100.087 },
} as const;
export type BaseId = keyof typeof BASES;
export const baseAddition = (base: BaseId, grams: number, volumeL: number): Pool =>
  ({ acids: {}, cations: volumeL > 0 ? (grams * BASES[base].eqPerG) / volumeL : 0 });
