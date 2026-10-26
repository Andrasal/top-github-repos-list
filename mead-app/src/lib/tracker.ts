/** Batch log & fermentation tracker — SPEC §20. Pure functions; `now` is injected for testability. */
import { abv as abvFn } from './abv';
import { sugarBreaks } from './fermentation';

export interface Reading { uid: string; at: string; sg: number; note?: string }
export interface BatchLog { pitchedAt: string | null; readings: Reading[]; dosesDone: boolean[] }
export const EMPTY_LOG: BatchLog = { pitchedAt: null, readings: [], dosesDone: [false, false, false, false] };

const H = 3600_000;
export type DoseState = 'done' | 'due' | 'overdue' | 'upcoming' | 'waiting';

export interface TrackerStatus {
  started: boolean;
  days: number;
  measuredOg: number;
  latest: Reading | null;
  currentAbv: number;
  attenuationPct: number;
  breakSg: number;
  breakReached: boolean;
  doses: { n: number; label: string; dueAt: number | null; state: DoseState }[];
  stage: 'not started' | 'lag' | 'active' | 'slowing' | 'stable' | 'stuck';
  message: string;
  series: { day: number; sg: number }[];
}

export function trackerStatus(log: BatchLog, planOg: number, predictedFg: number, now: number): TrackerStatus {
  const readings = [...log.readings].filter((r) => Number.isFinite(r.sg)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const pitch = log.pitchedAt ? Date.parse(log.pitchedAt) : null;
  const t0 = pitch ?? (readings[0] ? Date.parse(readings[0].at) : now);
  const measuredOg = readings.length && (pitch == null || Date.parse(readings[0].at) <= t0 + 12 * H) ? readings[0].sg : planOg;
  const latest = readings.at(-1) ?? null;
  const sg = latest?.sg ?? measuredOg;
  const breakSg = sugarBreaks(measuredOg, predictedFg).oneThird;
  const breakReached = sg <= breakSg;
  const days = pitch ? (now - pitch) / (24 * H) : 0;

  const due = pitch ? [pitch + 24 * H, pitch + 48 * H, pitch + 72 * H, pitch + 7 * 24 * H] : [null, null, null, null];
  const labels = ['24 h', '48 h', '72 h', '⅓ break or day 7'];
  const doses = labels.map((label, i) => {
    let state: DoseState;
    if (log.dosesDone[i]) state = 'done';
    else if (!pitch) state = 'waiting';
    else if (i === 3) state = breakReached || now >= due[3]! ? (now > due[3]! + 24 * H ? 'overdue' : 'due') : 'upcoming';
    else state = now < due[i]! ? 'upcoming' : now > due[i]! + 12 * H ? 'overdue' : 'due';
    return { n: i + 1, label, dueAt: due[i], state };
  });

  // Stage detection from the gravity series
  const recent = readings.filter((r) => Date.parse(r.at) >= (latest ? Date.parse(latest.at) : now) - 3.5 * 24 * H);
  const spanDays = recent.length >= 2 ? (Date.parse(recent.at(-1)!.at) - Date.parse(recent[0].at)) / (24 * H) : 0;
  const drop = recent.length >= 2 ? recent[0].sg - recent.at(-1)!.sg : 0;
  let stage: TrackerStatus['stage'] = 'not started';
  let message = 'Set the pitch time to start the nutrient timeline.';
  if (pitch) {
    stage = days < 1 && sg > measuredOg - 0.003 ? 'lag' : 'active';
    message = stage === 'lag' ? 'Lag phase: yeast are building up. Expect activity within 24–48 h.' : 'Fermenting. Degas before each nutrient addition.';
    if (recent.length >= 3 && spanDays >= 2.5 && drop < 0.0015) {
      if (sg <= predictedFg + 0.004) { stage = 'stable'; message = 'Gravity is stable at the expected finish. Ready to rack, clear and stabilise.'; }
      else { stage = 'stuck'; message = `Gravity has held at ${sg.toFixed(3)} for ${spanDays.toFixed(0)} days, above the expected ${predictedFg.toFixed(3)}. Check temperature and pH, rouse the yeast, and consider a restart.`; }
    } else if (breakReached && sg <= measuredOg - (measuredOg - predictedFg) * 0.75) { stage = 'slowing'; message = 'Past ¾ of the sugar. No more nutrients now; keep it warm and steady.'; }
  }

  return {
    started: pitch != null, days, measuredOg, latest,
    currentAbv: sg < measuredOg ? abvFn(measuredOg, sg) : 0,
    attenuationPct: measuredOg > 1 ? ((measuredOg - sg) / (measuredOg - 1)) * 100 : 0,
    breakSg, breakReached, doses, stage, message,
    series: readings.map((r) => ({ day: (Date.parse(r.at) - t0) / (24 * H), sg: r.sg })),
  };
}
