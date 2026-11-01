import type { ReactNode } from 'react';

export type PageId = 'plan' | 'yeast' | 'flavour' | 'acid' | 'brew' | 'stabilise' | 'sweeten' | 'bottle';
export type PhaseName = 'Plan' | 'Ferment' | 'Finish';

export interface PageDef { id: PageId; icon: string; label: string; phase: PhaseName; title: string; blurb: string; guide: { title: string; body: ReactNode } }

/** The guided flow, in brewing order (SPEC §29). Guide text is our own plain-language explainer. */
export const PAGES: PageDef[] = [
  {
    id: 'plan', icon: '🍯', label: 'Honey & batch', phase: 'Plan', title: 'Batch size, honey and fruit',
    blurb: 'Pick a batch size and how much honey and fruit go in. Water and starting gravity update as you type.',
    guide: { title: 'What is “must”, and how much honey?', body: <>
      <p><b>Must</b> is honey dissolved in water before the yeast goes in. Its strength is read as <b>gravity</b> (OG): water is 1.000, a typical mead starts around 1.090–1.110.</p>
      <p className="mt-1">Roughly 1 kg of honey per 3–3.5 L of must (about 3 lb per US gallon) makes a standard 12–14 % mead. Fruit brings its own sugar and juice, so the app takes water away to keep the volume right.</p>
      <p className="mt-1">New to this? Open <b>Style presets</b> below for a tested starting point.</p>
    </> },
  },
  {
    id: 'yeast', icon: '🧬', label: 'Yeast & nutrients', phase: 'Plan', title: 'Yeast and its food',
    blurb: 'Choose a strain, then follow the nutrient plan worked out for your batch.',
    guide: { title: 'Why yeast needs feeding', body: <>
      <p>Honey has almost no nitrogen. Hungry yeast gets stressed and makes harsh, solventy flavours, or stops early.</p>
      <p className="mt-1">Feeding in <b>four small doses</b> (24, 48 and 72 hours, then at the ⅓ sugar break) keeps it clean. The grams below are for your batch.</p>
      <p className="mt-1">Easy picks: <b>71B</b> softens tart fruit, <b>D47</b> gives body to traditionals (keep it under 20 °C), <b>EC-1118</b> is the bullet-proof strong finisher.</p>
    </> },
  },
  {
    id: 'flavour', icon: '🌸', label: 'Flavour & oak', phase: 'Plan', title: 'Flavour: flowers, spices, oak and tannin',
    blurb: 'Add botanicals, wood, tannin or aroma boosters, see the predicted flavour, and get suggestions that suit your recipe.',
    guide: { title: 'How much, and when?', body: <>
      <p>Most flavourings go in <b>after</b> the main ferment, in a sanitised bag, and are tasted every 2–3 days. Pull them when it tastes right: it is easy to add more and impossible to take it out.</p>
      <p className="mt-1"><b>Oak chips</b> work in 1–3 weeks, <b>cubes</b> in 4–12. <b>Tannin powders</b> stay in, so bench-trial a glass first. <b>L-phenylalanine</b> goes in at pitch: the yeast turns it into a rose-and-honey aroma.</p>
      <p className="mt-1">Each meter shows where your dose sits, from subtle to “will dominate”.</p>
    </> },
  },
  {
    id: 'acid', icon: '🍋', label: 'Acidity & pH', phase: 'Plan', title: 'Acidity and pH',
    blurb: 'Predicted pH and acidity from your ingredients and water, plus tools to adjust them.',
    guide: { title: 'Why pH matters', body: <>
      <p>Honey musts have little buffer, so pH can crash during fermentation and stall the yeast (below about 3.0). A finished mead around pH 3.4–3.7 tastes bright and keeps well.</p>
      <p className="mt-1">These are predictions. Measure with a pH meter when you can, and adjust acid after fermentation by tasting a glass first.</p>
    </> },
  },
  {
    id: 'brew', icon: '📋', label: 'Brew day & log', phase: 'Ferment', title: 'Brew day, checklist and gravity log',
    blurb: 'Tick through the steps, start the pitch timer and log hydrometer readings as it ferments.',
    guide: { title: 'How to tell when it’s finished', body: <>
      <p>Bubbles lie: an airlock can keep bubbling from dissolved CO₂. A ferment is done when the <b>gravity stays the same for three days</b>.</p>
      <p className="mt-1">Hydrometers are calibrated at one temperature; use the corrector if your sample is warm or cold.</p>
    </> },
  },
  {
    id: 'stabilise', icon: '🛡️', label: 'Stabilise', phase: 'Finish', title: 'Sulfite and sorbate',
    blurb: 'Protect the finished mead and, if you will sweeten it, stop the yeast from restarting.',
    guide: { title: 'Why both sulfite and sorbate?', body: <>
      <p><b>Sulfite</b> (K-meta or Campden) protects against oxidation and microbes; how much you need depends on pH. <b>Sorbate</b> stops yeast from multiplying.</p>
      <p className="mt-1">If you plan to add honey back, use both, wait 24–48 hours, then sweeten. Without them, sweetened mead can re-ferment in the bottle.</p>
    </> },
  },
  {
    id: 'sweeten', icon: '🥄', label: 'Backsweeten', phase: 'Finish', title: 'Backsweetening',
    blurb: 'Land on the sweetness and strength you want: honey, honey with water, or honey with spirit.',
    guide: { title: 'Why sweetening changes the ABV', body: <>
      <p>Honey adds volume as well as sugar, so the alcohol gets diluted: going from dry to semi-sweet usually costs 0.3–0.7 % ABV. This step shows that, and how to make up for it.</p>
    </> },
  },
  {
    id: 'bottle', icon: '🍾', label: 'Bottle & share', phase: 'Finish', title: 'Bottle, save and share',
    blurb: 'The finished mead at a glance, bottle counts, calories, export and a printable cellar sheet.',
    guide: { title: 'Before you bottle', body: <>
      <p>Bottle only when the mead is clear and the gravity has been stable for a few weeks. Sweetened meads must be stabilised first. Label each bottle with the name, date and ABV.</p>
    </> },
  },
];

export function GuideBox({ page, onHide }: { page: PageDef; onHide: () => void }) {
  return (
    <aside className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-stone-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-stone-200">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="font-semibold text-emerald-900 dark:text-emerald-200">🌱 {page.guide.title}</h3>
        <button type="button" className="shrink-0 text-xs underline" onClick={onHide}>Hide guide</button>
      </div>
      {page.guide.body}
    </aside>
  );
}
