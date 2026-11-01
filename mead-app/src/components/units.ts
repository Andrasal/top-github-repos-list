import { fromKg, fromLiters, toKg, toLiters, unitLabels, UnitSystem } from '../lib/units';

export function unitHelpers(u: UnitSystem) {
  const lab = unitLabels(u);
  return {
    u,
    lab,
    vol: { unit: lab.vol, toDisplay: (l: number) => fromLiters(l, u), fromDisplay: (d: number) => toLiters(d, u) },
    mass: { unit: lab.mass, toDisplay: (kg: number) => fromKg(kg, u), fromDisplay: (d: number) => toKg(d, u) },
    fmtVol: (l: number, d = 2) => `${fromLiters(l, u).toFixed(d)} ${lab.vol}`,
    fmtMass: (kg: number, d = 2) => `${fromKg(kg, u).toFixed(d)} ${lab.mass}`,
  };
}
export type UnitHelpers = ReturnType<typeof unitHelpers>;
export const uid = () => Math.random().toString(36).slice(2, 9);
