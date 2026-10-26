/**
 * Sulfite management — SPEC §13.
 * Free SO2 exists as molecular SO2 (antimicrobial) and bisulfite in a pH-dependent equilibrium:
 *   molecular = free / (1 + 10^(pH − pKa1)),  pKa1 = 1.81
 * Sources: margalit, zoecklein, usseglio (alcohol/temperature shift of pKa), ttb-4-22, eu-1333, ttb-4-32.
 */
import {
  CAMPDEN_KMETA_G, KMETA_SO2_FRACTION, KMETA_STOCK_PCT, MOLECULAR_SO2_SENSORY, NAMETA_SO2_FRACTION,
  SO2_LABEL_THRESHOLD, SO2_LIMIT_EU_MEAD, SO2_LIMIT_US_TOTAL, SO2_PKA1, SORBATE_DOSE_GPL,
  SORBIC_FRACTION_OF_KSORBATE, SORBIC_LIMIT_US,
} from './constants';

export type SulfiteForm = 'kmeta' | 'nameta' | 'campden';
export const SULFITE_FORMS: Record<SulfiteForm, { label: string; so2Fraction: number }> = {
  kmeta: { label: 'Potassium metabisulfite (K-meta)', so2Fraction: KMETA_SO2_FRACTION },
  nameta: { label: 'Sodium metabisulfite', so2Fraction: NAMETA_SO2_FRACTION },
  campden: { label: `Campden tablets (${CAMPDEN_KMETA_G} g K-meta)`, so2Fraction: KMETA_SO2_FRACTION },
};

/** SPEC §13.1 */
export function molecularFraction(pH: number, pKa = SO2_PKA1): number {
  if (!Number.isFinite(pH) || pH < 2 || pH > 5) throw new RangeError(`pH out of range: ${pH}`);
  return 1 / (1 + 10 ** (pH - pKa));
}
export const molecularSo2 = (freePpm: number, pH: number, pKa = SO2_PKA1) => freePpm * molecularFraction(pH, pKa);
export const freeForMolecular = (molecularPpm: number, pH: number, pKa = SO2_PKA1) => molecularPpm / molecularFraction(pH, pKa);

export interface SulfiteInput {
  volumeL: number;
  pH: number;
  currentFreePpm: number;
  currentTotalPpm: number;
  targetMolecularPpm: number;
  /** % of the added SO2 expected to bind immediately (acetaldehyde, sugars, pyruvate). */
  bindingPct: number;
  form: SulfiteForm;
  sorbate: boolean;
}

export interface SulfitePlan {
  input: SulfiteInput;
  molecularFraction: number;
  currentMolecularPpm: number;
  requiredFreePpm: number;
  additionPpm: number; // total SO2 to add (before binding)
  so2Grams: number;
  productGrams: number;
  campdenTablets: number;
  stockSolutionMl: number; // 10 % K-meta stock
  after: { freePpm: number; totalPpm: number; molecularPpm: number; boundPpm: number };
  sorbate: { grams: number; sorbicPpm: number } | null;
  warnings: { severity: 'info' | 'warning' | 'error'; text: string; source: string[] }[];
}

/** SPEC §13.2 */
export function sulfitePlan(x: SulfiteInput): SulfitePlan {
  const V = Math.max(0, x.volumeL);
  const f = molecularFraction(x.pH);
  const binding = Math.min(0.9, Math.max(0, x.bindingPct / 100));
  const requiredFreePpm = freeForMolecular(x.targetMolecularPpm, x.pH);
  const deficit = Math.max(0, requiredFreePpm - Math.max(0, x.currentFreePpm));
  const additionPpm = deficit / (1 - binding);
  const so2Grams = (additionPpm * V) / 1000;
  const form = SULFITE_FORMS[x.form];
  const productGrams = so2Grams / form.so2Fraction;
  const kmetaGrams = so2Grams / KMETA_SO2_FRACTION;
  const freePpm = Math.max(0, x.currentFreePpm) + additionPpm * (1 - binding);
  const totalPpm = Math.max(x.currentTotalPpm, x.currentFreePpm) + additionPpm;
  const after = { freePpm, totalPpm, molecularPpm: freePpm * f, boundPpm: totalPpm - freePpm };

  const sorbate = x.sorbate
    ? { grams: SORBATE_DOSE_GPL * V, sorbicPpm: SORBATE_DOSE_GPL * SORBIC_FRACTION_OF_KSORBATE * 1000 }
    : null;

  const w: SulfitePlan['warnings'] = [];
  if (totalPpm > SO2_LIMIT_US_TOTAL)
    w.push({ severity: 'error', text: `Total SO₂ ${totalPpm.toFixed(0)} mg/L exceeds the US limit of ${SO2_LIMIT_US_TOTAL} mg/L.`, source: ['ttb-4-22'] });
  else if (totalPpm > SO2_LIMIT_EU_MEAD)
    w.push({ severity: 'warning', text: `Total SO₂ ${totalPpm.toFixed(0)} mg/L exceeds the EU limit for mead (${SO2_LIMIT_EU_MEAD} mg/L).`, source: ['eu-1333'] });
  if (x.pH > 3.8)
    w.push({ severity: 'warning', text: `At pH ${x.pH.toFixed(2)} only ${(f * 100).toFixed(2)} % of free SO₂ is molecular, so protection needs ${requiredFreePpm.toFixed(0)} mg/L free. Lower the pH with acid first (≈3.4–3.6) — it is far more effective than adding more sulfite.`, source: ['margalit', 'zoecklein'] });
  if (after.molecularPpm > MOLECULAR_SO2_SENSORY)
    w.push({ severity: 'warning', text: `Molecular SO₂ ${after.molecularPpm.toFixed(2)} mg/L may be smelt (burnt match) above ~${MOLECULAR_SO2_SENSORY} mg/L.`, source: ['margalit'] });
  if (sorbate && sorbate.sorbicPpm > SORBIC_LIMIT_US)
    w.push({ severity: 'error', text: `Sorbic acid ${sorbate.sorbicPpm.toFixed(0)} mg/L exceeds the US limit of ${SORBIC_LIMIT_US} mg/L.`, source: ['ttb-24-246'] });
  if (sorbate)
    w.push({ severity: 'info', text: 'Sorbate only stops renewed yeast growth; it does not kill yeast. Add it with adequate free SO₂ and after the mead is clear and stable. Without SO₂, lactic bacteria can turn sorbate into a geranium off-odour.', source: ['zoecklein', 'practice'] });
  if (totalPpm >= SO2_LABEL_THRESHOLD)
    w.push({ severity: 'info', text: `Total SO₂ ≥ ${SO2_LABEL_THRESHOLD} mg/L: commercial labels in the US must state "Contains sulfites".`, source: ['ttb-4-32'] });
  w.push({ severity: 'info', text: 'pKa 1.81 is the aqueous value. At wine-level alcohol the effective pKa is higher, so real molecular SO₂ is somewhat above this estimate (a conservative error). Re-measure free SO₂ 24–48 h after each addition.', source: ['usseglio', 'margalit'] });

  return {
    input: x,
    molecularFraction: f,
    currentMolecularPpm: Math.max(0, x.currentFreePpm) * f,
    requiredFreePpm,
    additionPpm,
    so2Grams,
    productGrams,
    campdenTablets: kmetaGrams / CAMPDEN_KMETA_G,
    stockSolutionMl: so2Grams / ((KMETA_STOCK_PCT / 100) * KMETA_SO2_FRACTION),
    after,
    sorbate,
    warnings: w,
  };
}
