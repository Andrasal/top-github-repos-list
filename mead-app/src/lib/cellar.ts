/**
 * Cellar tools (SPEC §26): hydrometer temperature correction, refractometer readings,
 * calories, bench-trial scaling and sulfite-from-weight. Pure functions.
 */
import { platoToSg } from './gravity';
import { RHO_WATER_20C } from './constants';
import { SULFITE_FORMS, type SulfiteForm } from './sulfite';

/** True density of ethanol at 20 °C (g/mL); the ABV formula's 0.794 is Hall's fitted value, not this. */
const ETHANOL_TRUE_DENSITY = 0.78924;

/** Density of air-free water, kg/L, 0–40 °C (Tanaka et al., Metrologia 38, 2001). */
export function waterDensity(tC: number): number {
  const a1 = -3.983035, a2 = 301.797, a3 = 522528.9, a4 = 69.34881, a5 = 999.97495;
  return (a5 * (1 - ((tC + a1) ** 2 * (tC + a2)) / (a3 * (tC + a4)))) / 1000;
}

/**
 * Hydrometer reading taken at `sampleC` on an instrument calibrated at `calC`.
 * A warm sample is less dense, so the hydrometer reads low: SG = R × ρw(cal) / ρw(sample).
 * Ignores the glass's own expansion (< 0.0002 over 10–30 °C).
 */
export function hydrometerCorrect(reading: number, sampleC: number, calC = 20): number {
  return (reading * waterDensity(calC)) / waterDensity(sampleC);
}

/** Refractometer before fermentation: °Brix ÷ wort correction factor → SG (Lincoln). */
export function refractometerOg(brix: number, wcf = 1.0): number {
  return platoToSg(brix / wcf);
}

/**
 * Refractometer after fermentation starts: alcohol bends light, so the raw reading is wrong.
 * Terrill (2011) cubic from original and current °Brix (each ÷ WCF). Fitted on beer: treat
 * as ±0.003 for mead and confirm the finish with a hydrometer.
 */
export function refractometerFg(ogBrix: number, fgBrix: number, wcf = 1.0): number {
  const ob = ogBrix / wcf, fb = fgBrix / wcf;
  return 1 - 0.0044993 * ob + 0.011774 * fb + 0.00027581 * ob ** 2 - 0.0012717 * fb ** 2 - 0.00000728 * ob ** 3 + 0.000063293 * fb ** 3;
}

/** kcal in one serving: ethanol 7.0 kcal/g, sugar 4 kcal/g. */
export function caloriesPerServing(abvPct: number, residualSugarGPerL: number, servingMl: number): number {
  const ethanolG = ((servingMl * abvPct) / 100) * ETHANOL_TRUE_DENSITY;
  return ethanolG * 7 + (residualSugarGPerL * servingMl / 1000) * 4;
}

/** Scale a tasting-glass trial to the batch: mg in the glass → g/L → grams for the batch. */
export function benchTrial(sampleMl: number, additiveMg: number, batchL: number): { gPerL: number; grams: number } {
  const gPerL = sampleMl > 0 ? additiveMg / sampleMl : 0;
  return { gPerL, grams: gPerL * Math.max(0, batchL) };
}

/** SO₂ (mg/L) delivered by a weighed amount of K-meta / Na-meta in a volume. */
export function sulfitePpmFromGrams(grams: number, volumeL: number, form: SulfiteForm = 'kmeta'): number {
  if (!(volumeL > 0)) return 0;
  const f = SULFITE_FORMS[form];
  return (grams * f.so2Fraction * 1000) / volumeL;
}

/** Vessel presets (nominal volume) for quick batch sizing. */
export const VESSELS: { label: string; litres: number; scale: 'home' | 'pro' }[] = [
  { label: '1 US gal', litres: 3.785411784, scale: 'home' },
  { label: '5 L', litres: 5, scale: 'home' },
  { label: '10 L', litres: 10, scale: 'home' },
  { label: '3 US gal', litres: 3 * 3.785411784, scale: 'home' },
  { label: '5 US gal', litres: 5 * 3.785411784, scale: 'home' },
  { label: '20 L', litres: 20, scale: 'home' },
  { label: '6 US gal', litres: 6 * 3.785411784, scale: 'home' },
  { label: '25 L', litres: 25, scale: 'home' },
  { label: '1 bbl', litres: 117.347765, scale: 'pro' },
  { label: '3.5 bbl', litres: 3.5 * 117.347765, scale: 'pro' },
  { label: '500 L', litres: 500, scale: 'pro' },
  { label: '7 bbl', litres: 7 * 117.347765, scale: 'pro' },
  { label: '1,000 L IBC', litres: 1000, scale: 'pro' },
  { label: '15 bbl', litres: 15 * 117.347765, scale: 'pro' },
];

export { RHO_WATER_20C };
