/** Exact SI ⇄ US-customary conversions — SPEC §2.3. Math is SI-only; these are for the UI boundary. */
export const L_PER_GAL = 3.785411784;
export const KG_PER_LB = 0.45359237;
export const G_PER_OZ = 28.349523125;
export const GPL_PER_OZGAL = G_PER_OZ / L_PER_GAL; // 7.48915…
export const PPG_PER_PKL = KG_PER_LB / L_PER_GAL; // 0.119826…

export type UnitSystem = 'metric' | 'imperial';

export const toLiters = (v: number, u: UnitSystem) => (u === 'metric' ? v : v * L_PER_GAL);
export const fromLiters = (l: number, u: UnitSystem) => (u === 'metric' ? l : l / L_PER_GAL);
export const toKg = (v: number, u: UnitSystem) => (u === 'metric' ? v : v * KG_PER_LB);
export const fromKg = (kg: number, u: UnitSystem) => (u === 'metric' ? kg : kg / KG_PER_LB);
export const toGrams = (v: number, u: UnitSystem) => (u === 'metric' ? v : v * G_PER_OZ);
export const fromGrams = (g: number, u: UnitSystem) => (u === 'metric' ? g : g / G_PER_OZ);
export const fromGPerL = (gpl: number, u: UnitSystem) => (u === 'metric' ? gpl : gpl / GPL_PER_OZGAL);
export const celsiusToF = (c: number) => (c * 9) / 5 + 32;

export const unitLabels = (u: UnitSystem) =>
  u === 'metric'
    ? { vol: 'L', mass: 'kg', small: 'g', conc: 'g/L', temp: '°C' }
    : { vol: 'gal', mass: 'lb', small: 'oz', conc: 'oz/gal', temp: '°F' };
