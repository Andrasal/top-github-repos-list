/**
 * Brew-day checklist (SPEC §28): concrete, recipe-specific steps from sanitising to bottling,
 * generated from the analysis. Step ids are stable so ticked steps survive recipe edits.
 */
import type { Analysis } from './recipe';
import { fruitById, honeyById, spiceById, sugarById } from './db';

export type Phase = 'prep' | 'brew' | 'primary' | 'secondary' | 'finish' | 'bottle';
export const PHASE_LABEL: Record<Phase, string> = {
  prep: 'Get ready', brew: 'Brew day', primary: 'Primary ferment', secondary: 'Secondary', finish: 'Stabilise & finish', bottle: 'Bottle',
};
export interface Step { id: string; phase: Phase; text: string; detail?: string }
export interface Fmt { vol(l: number): string; mass(kg: number): string }

const g = (x: number) => `${x < 10 ? x.toFixed(1) : x.toFixed(0)} g`;

export function brewDaySteps(a: Analysis, f: Fmt): Step[] {
  const r = a.recipe;
  const s: Step[] = [];
  const V = a.whole.volumeL;
  s.push({ id: 'sanitise', phase: 'prep', text: 'Clean and sanitise the fermenter, lid, airlock, spoon, hydrometer and anything that touches the must.' });
  s.push({ id: 'vessel', phase: 'prep', text: `Use a fermenter of at least ${f.vol(a.occupancy.recommendedFermenterL)}`, detail: `Leaves ${(a.occupancy.headspaceFraction * 100).toFixed(0)} % headspace for foam${r.fruits.some((x) => x.stage === 'primary' && x.massKg > 0) ? ' and the fruit cap' : ''}.` });

  const honeys = r.honeys.filter((h) => h.massKg > 0);
  if (r.mode === 'targetVolume') {
    s.push({ id: 'water', phase: 'brew', text: `Add about ${f.vol(a.primary.waterL * 0.7)} of water first`, detail: `You'll need ${f.vol(a.primary.waterL)} in total. Keep the rest to top up.` });
  } else {
    s.push({ id: 'water', phase: 'brew', text: `Measure out ${f.vol(r.waterL)} of water` });
  }
  for (const h of honeys) s.push({ id: `honey-${h.uid}`, phase: 'brew', text: `Stir in ${f.mass(h.massKg)} of ${honeyById(h.honeyId).name.toLowerCase()} honey until fully dissolved`, detail: 'Warm (not hot) water helps; shake or stir hard for a few minutes.' });
  for (const x of r.sugars.filter((x) => x.massKg > 0)) s.push({ id: `sugar-${x.uid}`, phase: 'brew', text: `Dissolve ${f.mass(x.massKg)} of ${sugarById(x.sugarId).name.toLowerCase()}` });
  for (const x of r.fruits.filter((x) => x.stage === 'primary' && x.massKg > 0)) {
    s.push({ id: `fruit-${x.uid}`, phase: 'brew', text: `Add ${f.mass(x.massKg)} of ${fruitById(x.fruitId).name.toLowerCase()}`, detail: 'Frozen and thawed, in a sanitised mesh bag. Add pectic enzyme if you have it.' });
  }
  if (r.mode === 'targetVolume') s.push({ id: 'topup', phase: 'brew', text: `Top up with water to ${f.vol(a.primary.volumeL)} of must` });
  s.push({ id: 'og', phase: 'brew', text: `Take a hydrometer reading: aim for OG ${a.og.toFixed(3)}`, detail: 'Log it on the Batch log so ABV and the sugar breaks use your real number.' });
  const used = r.spices.filter((x) => x.grams > 0).map((x) => ({ x, sp: spiceById(x.spiceId) }));
  for (const { x, sp } of used.filter((u) => u.sp.addAt === 'pitch')) {
    s.push({ id: `spice-${x.uid}`, phase: 'brew', text: `Add ${g(x.grams)} of ${sp.name}`, detail: sp.use });
  }
  const rh = a.rehydration;
  s.push({ id: 'pitch', phase: 'brew', text: `Rehydrate ${g(rh.yeastG)} of ${a.yeast.name} with ${g(rh.goFermG)} Go-Ferm and pitch`, detail: `Go-Ferm in ${rh.waterMl.toFixed(0)} mL of water at ${rh.waterTempC} °C, yeast in for 15–20 min, then pitch. Ferment at ${a.yeast.tempC[0]}–${a.yeast.tempC[1]} °C.` });
  s.push({ id: 'airlock', phase: 'brew', text: 'Fit the lid and an airlock filled with sanitiser' });

  for (const d of a.schedule.doses) {
    const parts = [d.fermaidO > 0 && `${g(d.fermaidO)} Fermaid O`, d.fermaidK > 0 && `${g(d.fermaidK)} Fermaid K`, d.dap > 0 && `${g(d.dap)} DAP`].filter(Boolean).join(' + ');
    s.push({ id: `dose-${d.n}`, phase: 'primary', text: `Nutrient dose ${d.n} (${d.when}): ${parts || 'none needed'}`, detail: d.sgTrigger ? `Sugar break at SG ${d.sgTrigger.toFixed(3)}. Dissolve in a little must and degas gently first.` : 'Dissolve in a little must and degas gently before adding.' });
  }
  s.push({ id: 'degas', phase: 'primary', text: 'Swirl or stir gently once a day to release CO₂ until the ⅓ sugar break' });
  if (r.fruits.some((x) => x.stage === 'primary' && x.massKg > 0)) s.push({ id: 'cap', phase: 'primary', text: 'Push the fruit cap down 1–2 times a day' });
  s.push({ id: 'stable', phase: 'primary', text: `Wait until the gravity holds steady for 3 days${a.fg.fg <= 1.0 ? ` (around ${a.fg.fg.toFixed(3)})` : ''}` });

  s.push({ id: 'rack1', phase: 'secondary', text: `Rack off the lees into a clean vessel (expect about ${f.vol(a.occupancy.recoveredL)})` });
  for (const x of r.fruits.filter((x) => x.stage === 'secondary' && x.massKg > 0)) s.push({ id: `fruit2-${x.uid}`, phase: 'secondary', text: `Add ${f.mass(x.massKg)} of ${fruitById(x.fruitId).name.toLowerCase()} for 1–3 weeks` });
  for (const { x, sp } of used.filter((u) => (u.sp.addAt ?? 'secondary') === 'secondary')) {
    if (sp.group === 'tannin') {
      s.push({ id: `spice-${x.uid}`, phase: 'secondary', text: `Add ${g(x.grams)} of ${sp.name.toLowerCase()}`, detail: sp.use });
    } else {
      const wood = sp.group === 'wood';
      s.push({
        id: `spice-${x.uid}`, phase: 'secondary', text: `Add ${g(x.grams)} of ${sp.name.toLowerCase()}${wood ? '' : ' in a sanitised bag'}`,
        detail: `${wood ? 'Sanitise by steaming or a quick soak, then add. ' : ''}Taste from day ${sp.contactDays[0]}; usually ${sp.contactDays[0]}–${sp.contactDays[1]} days. Remove when it tastes right.`,
      });
    }
  }
  s.push({ id: 'clear', phase: 'secondary', text: 'Let it clear and age; rack again whenever a layer of sediment forms' });

  for (const { x, sp } of used.filter((u) => u.sp.addAt === 'clearing')) {
    s.push({ id: `spice-${x.uid}`, phase: 'finish', text: `Fine with ${g(x.grams)} of ${sp.name.toLowerCase()}`, detail: sp.use });
  }
  const so = a.sulfite;
  if (so.productGrams > 0) s.push({ id: 'so2', phase: 'finish', text: `Stabilise: ${so.productGrams.toFixed(2)} g K-meta (or equivalent) for ${f.vol(so.input.volumeL)}`, detail: `Brings free SO₂ to about ${so.after.freePpm.toFixed(0)} mg/L at pH ${so.input.pH.toFixed(2)}.` });
  if (so.sorbate) s.push({ id: 'sorbate', phase: 'finish', text: `Add ${g(so.sorbate.grams)} potassium sorbate with the sulfite`, detail: 'Only stops yeast multiplying; it cannot stop an active ferment.' });
  if (r.targetFg != null) s.push({ id: 'sweeten', phase: 'finish', text: `After 24–48 h, back-sweeten to ${r.targetFg.toFixed(3)}`, detail: 'Use the Backsweeten step to account for the extra volume and diluted ABV.' });
  s.push({ id: 'taste', phase: 'finish', text: 'Bench-test acid and sweetness in a glass before dosing the whole batch' });

  const b750 = a.bottles.find((b) => b.sizeL === 0.75)?.count ?? 0;
  s.push({ id: 'bottles', phase: 'bottle', text: `Sanitise about ${b750} × 750 mL bottles (${f.vol(a.occupancy.recoveredL + (V - a.primary.volumeL))})` });
  s.push({ id: 'bottle', phase: 'bottle', text: 'Bottle, label with name, date and ABV, and store cool and dark' });
  return s;
}
