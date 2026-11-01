/** Yeast & nutrient kinetics — SPEC §7. Sources: tosna, scott-handbook, meadmaderight, ttb-24-246. */
import {
  DAP_YAN, DAP_LEGAL_MAX, FERMAID_K_YAN, FERMAID_O_YAN_EFFECTIVE, FERMAID_K_DOSE_MAX,
  GOFERM_RATIO, GOFERM_WATER_RATIO, YAN_FACTORS, NDemand,
} from './constants';
import { sgToBrix } from './gravity';
import { L_PER_GAL } from './units';

export type Protocol = 'tosna3' | 'kDap' | 'oK';

export const PROTOCOL_LABELS: Record<Protocol, string> = {
  tosna3: 'TOSNA 3.0 (Fermaid O only)',
  kDap: 'Fermaid K + DAP (inorganic early)',
  oK: 'Hybrid: Fermaid O → Fermaid K',
};

/** SPEC §7.1 — YAN_req = Brix × 10 × factor. Credit subtracts fruit YAN (never below 0). */
export function yanRequirement(og: number, demand: NDemand, creditPpm = 0) {
  const brix = sgToBrix(og);
  const gross = Math.max(0, brix * 10 * YAN_FACTORS[demand]);
  return { brix, factor: YAN_FACTORS[demand], grossPpm: gross, creditPpm, netPpm: Math.max(0, gross - creditPpm) };
}

export interface Dose {
  n: 1 | 2 | 3 | 4;
  when: string;
  /** Gravity trigger for dose 4 (the 1/3 sugar break). */
  sgTrigger?: number;
  fermaidO: number; // grams
  fermaidK: number;
  dap: number;
  ppm: number; // effective YAN delivered by this dose
}

export interface Schedule {
  protocol: Protocol;
  targetPpm: number;
  volumeL: number;
  doses: Dose[];
  totals: { fermaidO: number; fermaidK: number; dap: number; ppm: number };
  warnings: { severity: 'warning' | 'error'; text: string }[];
}

const WHEN = ['24 h after pitch', '48 h after pitch', '72 h after pitch', '1/3 sugar break or day 7 (whichever first)'] as const;

/** SPEC §7.2 — four additions; doses always sum to the total. */
export function nutrientSchedule(protocol: Protocol, yanPpm: number, volumeL: number, oneThirdBreakSg: number): Schedule {
  const V = Math.max(0, volumeL);
  const Y = Math.max(0, yanPpm);
  const doses: Dose[] = [];
  const mk = (i: number, o: number, k: number, d: number): Dose => ({
    n: (i + 1) as Dose['n'],
    when: WHEN[i],
    sgTrigger: i === 3 ? oneThirdBreakSg : undefined,
    fermaidO: o, fermaidK: k, dap: d,
    ppm: V > 0 ? ((o * FERMAID_O_YAN_EFFECTIVE) + (k * FERMAID_K_YAN) + (d * DAP_YAN)) / V : 0,
  });

  if (protocol === 'tosna3') {
    const total = (Y / FERMAID_O_YAN_EFFECTIVE) * V;
    for (let i = 0; i < 4; i++) doses.push(mk(i, total / 4, 0, 0));
  } else if (protocol === 'kDap') {
    const kTotal = ((0.5 * Y) / FERMAID_K_YAN) * V;
    const dapTotal = ((0.5 * Y) / DAP_YAN) * V;
    // DAP is never added at or after the 1/3 break: split across doses 1–3 only. SPEC §7.2/§7.3
    for (let i = 0; i < 4; i++) doses.push(mk(i, 0, kTotal / 4, i < 3 ? dapTotal / 3 : 0));
  } else {
    const perDose = Y / 4;
    for (let i = 0; i < 4; i++) {
      doses.push(i < 2 ? mk(i, (perDose / FERMAID_O_YAN_EFFECTIVE) * V, 0, 0) : mk(i, 0, (perDose / FERMAID_K_YAN) * V, 0));
    }
  }

  const totals = doses.reduce(
    (a, d) => ({ fermaidO: a.fermaidO + d.fermaidO, fermaidK: a.fermaidK + d.fermaidK, dap: a.dap + d.dap, ppm: a.ppm + d.ppm }),
    { fermaidO: 0, fermaidK: 0, dap: 0, ppm: 0 },
  );

  const warnings: Schedule['warnings'] = [];
  if (V > 0 && totals.dap / V > DAP_LEGAL_MAX)
    warnings.push({ severity: 'error', text: `DAP ${(totals.dap / V).toFixed(2)} g/L exceeds the US legal limit of ${DAP_LEGAL_MAX} g/L (27 CFR 24.246). Switch to an organic protocol.` });
  if (doses[3].dap > 0)
    warnings.push({ severity: 'error', text: 'DAP scheduled at/after the 1/3 sugar break — yeast cannot use it and it feeds spoilage organisms.' });
  if (V > 0 && doses.some((d) => d.fermaidK / V > FERMAID_K_DOSE_MAX))
    warnings.push({ severity: 'warning', text: `A single Fermaid K addition exceeds ${FERMAID_K_DOSE_MAX} g/L — split further or switch to Fermaid O.` });
  if (Y > 400)
    warnings.push({ severity: 'warning', text: `YAN requirement ${Y.toFixed(0)} mg/L is very high — consider step-feeding part of the honey at the 1/3 break.` });

  return { protocol, targetPpm: Y, volumeL: V, doses, totals, warnings };
}

/** SPEC §7.2 — rehydration: yeast max(2 g/gal, 0.5 g/L) → 1 g/L above OG 1.120; Go-Ferm 1.25×; water 20× Go-Ferm. */
export function rehydration(volumeL: number, og: number) {
  const base = Math.max((2 / L_PER_GAL) * volumeL, 0.5 * volumeL);
  const yeastG = og > 1.12 ? Math.max(base, 1 * volumeL) : base;
  const goFermG = yeastG * GOFERM_RATIO;
  return { yeastG, goFermG, waterMl: goFermG * GOFERM_WATER_RATIO, waterTempC: 43 };
}
