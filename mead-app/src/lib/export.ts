/**
 * Excel / Google Sheets export — SPEC §14.
 * Key results are written as LIVE formulas (ABV, sulfite, nutrient totals) with cached values,
 * so the workbook recalculates when edited in Excel or after import into Google Sheets.
 */
import ExcelJS from 'exceljs';
import type { Analysis } from './recipe';
import { fruitById, honeyById, spiceById, sugarById } from './db';
import { spiceBand } from './flavor';
import { PROTOCOL_LABELS } from './nutrients';
import { SOURCES } from './sources';
import { SULFITE_FORMS } from './sulfite';
import { CAMPDEN_KMETA_G, KMETA_SO2_FRACTION, SO2_LIMIT_EU_MEAD, SO2_LIMIT_US_TOTAL, SO2_PKA1 } from './constants';

const C = {
  title: 'FF78350F', header: 'FFFDE68A', input: 'FFFEF3C7', section: 'FF92400E', border: 'FFD6D3D1',
  error: 'FFFEE2E2', warning: 'FFFEF3C7', tip: 'FFD1FAE5', info: 'FFF5F5F4',
};
const thin = { style: 'thin' as const, color: { argb: C.border } };
const box = { top: thin, left: thin, bottom: thin, right: thin };

function title(ws: ExcelJS.Worksheet, text: string, sub: string, span = 'A1:F1') {
  ws.mergeCells(span);
  const t = ws.getCell('A1');
  t.value = text;
  t.font = { size: 16, bold: true, color: { argb: C.title } };
  ws.getRow(1).height = 26;
  ws.getCell('A2').value = sub;
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF78716C' } };
}

function header(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.header } };
    c.border = box;
    c.alignment = { vertical: 'middle', wrapText: true };
  });
}

function section(ws: ExcelJS.Worksheet, r: number, text: string) {
  const c = ws.getCell(r, 1);
  c.value = text;
  c.font = { bold: true, size: 12, color: { argb: C.section } };
}

function bordered(row: ExcelJS.Row) {
  row.eachCell({ includeEmpty: false }, (c) => (c.border = box));
}

const f = (formula: string, result: number | string) => ({ formula, result });

export function buildWorkbook(a: Analysis, opts: { generated?: Date } = {}): ExcelJS.Workbook {
  const r = a.recipe;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Mead Lab';
  wb.created = opts.generated ?? new Date();
  wb.calcProperties = { fullCalcOnLoad: true };
  const stamp = `Generated ${wb.created.toISOString().slice(0, 10)} · math per mead_app_spec.md · yellow cells are editable inputs`;

  // ── Summary ────────────────────────────────────────────────────────────────
  const s = wb.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 2 }] });
  s.columns = [{ width: 30 }, { width: 14 }, { width: 10 }, { width: 62 }];
  title(s, `Mead Lab — ${r.name}`, stamp, 'A1:D1');
  section(s, 4, 'Gravity & alcohol');
  header(s.getRow(5));
  s.getRow(5).values = ['Measure', 'Value', 'Unit', 'Notes'];
  header(s.getRow(5));
  const rows: [string, unknown, string, string, string?][] = [
    ['Original gravity (measured)', a.og, 'SG', `${a.yan.brix.toFixed(1)} °Brix`, '0.000'],
    ['Effective OG (incl. secondary fruit)', a.effectiveOg, 'SG', 'Used for ABV. Edit to recompute.', '0.000'],
    ['Final gravity (predicted)', a.fg.fg, 'SG', a.fg.limitedBy === 'yeast' ? 'Limited by yeast tolerance' : a.fg.limitedBy === 'target' ? 'Your target FG' : 'Ferments dry. Replace with your measured FG.', '0.000'],
    ['ABV (Alternative equation)', f('(76.08*(B7-B8)/(1.775-B7))*(B8/0.794)', a.abv), '% v/v', 'Hall (1995): [76.08·(OG−FG)/(1.775−OG)]·[FG/0.794]', '0.00'],
    ['ABW', f('76.08*(B7-B8)/(1.775-B7)', a.abw), '% w/w', 'Alcohol by weight', '0.00'],
    ['Sweetness', a.sweetness, '', `≈ ${a.residualSugarGPerL.toFixed(0)} g/L residual sugar`],
    ['Strength', a.strength, '', 'Traditional mead terms; own thresholds'],
    ['⅓ sugar break', a.breaks.oneThird, 'SG', 'Trigger for nutrient dose 4', '0.000'],
  ];
  rows.forEach(([k, v, u, n, fmt], i) => {
    const row = s.getRow(6 + i);
    row.values = [k, v as ExcelJS.CellValue, u, n];
    if (fmt) row.getCell(2).numFmt = fmt;
    bordered(row);
  });
  for (const ref of ['B7', 'B8']) s.getCell(ref).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.input } };
  s.getCell('B9').font = { bold: true, color: { argb: C.title } };

  section(s, 15, 'Volumes');
  s.getRow(16).values = ['Measure', 'Litres', 'US gal', 'Notes'];
  header(s.getRow(16));
  const vols: [string, number, string][] = [
    ['Must liquid volume', a.primary.volumeL, r.mode === 'targetVolume' ? 'Target volume' : 'Derived from water added'],
    ['Water to add', a.primary.waterL, 'Solved by mass balance'],
    ['Total incl. secondary juice', a.whole.volumeL, ''],
    ['Day-0 fermenter occupancy', a.occupancy.day0L, 'Liquid + intact fruit'],
    ['Recommended fermenter', a.occupancy.recommendedFermenterL, `${(a.occupancy.headspaceFraction * 100).toFixed(0)} % headspace`],
    ['Expected recovered', a.occupancy.recoveredL, 'After pulp and lees losses'],
  ];
  vols.forEach(([k, l, n], i) => {
    const row = s.getRow(17 + i);
    const rr = 17 + i;
    row.values = [k, l, f(`B${rr}/3.785411784`, l / 3.785411784), n];
    row.getCell(2).numFmt = '0.00';
    row.getCell(3).numFmt = '0.00';
    bordered(row);
  });
  s.getCell('A24').value = `Yeast: ${a.yeast.name} (${a.yeast.tolerance} % tolerance, ${a.demand} N demand). Protocol: ${PROTOCOL_LABELS[r.protocol]}.`;
  s.getCell('A24').font = { italic: true };

  // ── Ingredients ────────────────────────────────────────────────────────────
  const ing = wb.addWorksheet('Ingredients', { views: [{ state: 'frozen', ySplit: 4 }] });
  ing.columns = [{ width: 10 }, { width: 28 }, { width: 11 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 9 }, { width: 8 }, { width: 8 }, { width: 50 }];
  title(ing, 'Fermentables', stamp, 'A1:J1');
  ing.getRow(4).values = ['Type', 'Ingredient', 'Stage', 'Mass (kg)', 'Mass (lb)', 'Sugar (kg)', '+ Points', 'PKL', 'PPG', 'Notes'];
  header(ing.getRow(4));
  let row = 5;
  const contrib = new Map(a.contributions.map((c) => [c.key, c]));
  const put = (type: string, name: string, stage: string, kg: number, key: string, note: string, sugarKg?: number) => {
    const c = contrib.get(key);
    const rw = ing.getRow(row);
    rw.values = [type, name, stage, kg, f(`D${row}/0.45359237`, kg / 0.45359237), c?.sugarKg ?? sugarKg ?? 0, c?.deltaPoints ?? '', c?.pkl ?? '', c?.ppg ?? '', note];
    ['D', 'E', 'F'].forEach((col) => (ing.getCell(`${col}${row}`).numFmt = '0.000'));
    ['G', 'I'].forEach((col) => (ing.getCell(`${col}${row}`).numFmt = '0.0'));
    ing.getCell(`H${row}`).numFmt = '0';
    bordered(rw);
    row++;
  };
  r.honeys.forEach((h) => { const x = honeyById(h.honeyId); put('Honey', x.name, 'Primary', h.massKg, h.uid, x.character); });
  r.sugars.forEach((g) => { const x = sugarById(g.sugarId); put('Sugar', x.name, 'Primary', g.massKg, g.uid, `${x.purity * 100} % fermentable`); });
  r.fruits.forEach((fr) => {
    const x = fruitById(fr.fruitId);
    put('Fruit', x.name, fr.stage === 'primary' ? 'Primary' : 'Secondary', fr.massKg, fr.uid, `${x.brix} °Bx, TA ${x.ta} g/L ${x.acid}, pH ${x.ph}. ${x.notes}`, fr.massKg * (1 - x.insoluble) * x.brix / 100);
  });
  const last = row - 1;
  const tr = ing.getRow(row);
  tr.values = ['Total', '', '', f(`SUM(D5:D${last})`, 0), f(`SUM(E5:E${last})`, 0), f(`SUM(F5:F${last})`, 0)];
  tr.font = { bold: true };
  ['D', 'E', 'F'].forEach((col) => (ing.getCell(`${col}${row}`).numFmt = '0.000'));
  row += 3;
  section(ing, row++, 'Spices & adjuncts');
  ing.getRow(row).values = ['', 'Spice', 'Grams', 'g/L', 'Band', 'Subtle', 'Typical', 'Bold', 'Max', 'Contact & notes'];
  header(ing.getRow(row));
  row++;
  r.spices.forEach((sp) => {
    const x = spiceById(sp.spiceId);
    const gpl = a.whole.volumeL > 0 ? sp.grams / a.whole.volumeL : 0;
    const rw = ing.getRow(row);
    rw.values = ['', x.name, sp.grams, f(`C${row}/${a.whole.volumeL.toFixed(4)}`, gpl), spiceBand(x, gpl), x.subtle, x.typical, x.bold, x.max, `${x.contactDays[0]}–${x.contactDays[1]} days, ${x.form}. ${x.notes}`];
    ing.getCell(`D${row}`).numFmt = '0.000';
    bordered(rw);
    row++;
  });
  if (r.spices.length === 0) ing.getCell(`B${row}`).value = 'None';

  // ── Nutrients ──────────────────────────────────────────────────────────────
  const n = wb.addWorksheet('Nutrients');
  n.columns = [{ width: 6 }, { width: 40 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 12 }];
  title(n, 'Yeast nutrition — staggered additions', stamp, 'A1:G1');
  const nRows: [string, number | string, string][] = [
    ['Brix of must', a.yan.brix, '°Bx'],
    ['Demand factor', a.yan.factor, `${a.demand}`],
    ['Fruit YAN credit', a.yan.creditPpm, 'mg N/L'],
    ['YAN target', a.yan.netPpm, 'mg N/L'],
    ['Volume', a.schedule.volumeL, 'L'],
    ['Yeast to pitch', a.rehydration.yeastG, 'g'],
    ['Go-Ferm (rehydration)', a.rehydration.goFermG, `g in ${a.rehydration.waterMl.toFixed(0)} mL water at 43 °C`],
  ];
  nRows.forEach(([k, v, u], i) => {
    const rw = n.getRow(4 + i);
    rw.values = ['', k, v, u];
    if (typeof v === 'number') rw.getCell(3).numFmt = '0.00';
    bordered(rw);
  });
  n.getCell('C7').value = f('MAX(0,C4*10*C5-C6)', a.yan.netPpm);
  n.getCell('C7').numFmt = '0';
  n.getCell('B12').value = PROTOCOL_LABELS[r.protocol];
  n.getCell('B12').font = { bold: true, color: { argb: C.section } };
  n.getRow(13).values = ['#', 'When', 'Fermaid O (g)', 'Fermaid K (g)', 'DAP (g)', 'YAN (mg/L)', 'SG trigger'];
  header(n.getRow(13));
  a.schedule.doses.forEach((d, i) => {
    const rw = n.getRow(14 + i);
    rw.values = [d.n, d.when, d.fermaidO, d.fermaidK, d.dap, d.ppm, d.sgTrigger ?? ''];
    [3, 4, 5].forEach((c) => (rw.getCell(c).numFmt = '0.00'));
    rw.getCell(6).numFmt = '0';
    rw.getCell(7).numFmt = '0.000';
    bordered(rw);
  });
  const tot = n.getRow(18);
  tot.values = ['', 'Total', f('SUM(C14:C17)', a.schedule.totals.fermaidO), f('SUM(D14:D17)', a.schedule.totals.fermaidK), f('SUM(E14:E17)', a.schedule.totals.dap), f('SUM(F14:F17)', a.schedule.totals.ppm)];
  tot.font = { bold: true };
  [3, 4, 5].forEach((c) => (tot.getCell(c).numFmt = '0.00'));
  tot.getCell(6).numFmt = '0';
  n.getCell('B20').value = 'Fermaid O counted at 160 mg N/L per g/L (40 label × 4 organic factor), Fermaid K 100, DAP 210. Degas before each addition.';
  n.getCell('B21').value = 'Fermaid®, Go-Ferm® and Lalvin® are trademarks of Lallemand Inc.; product names are used only to identify the products.';
  n.getCell('B21').font = { italic: true, size: 9, color: { argb: 'FF78716C' } };

  // ── Sulfite (live calculator) ──────────────────────────────────────────────
  const so = a.sulfite;
  const w = wb.addWorksheet('Sulfite');
  w.columns = [{ width: 40 }, { width: 14 }, { width: 10 }, { width: 60 }];
  title(w, 'Sulfite & stabilisation — live calculator', 'Yellow cells are inputs. Everything else recalculates.', 'A1:D1');
  w.getRow(4).values = ['Input', 'Value', 'Unit', 'Notes'];
  header(w.getRow(4));
  const inputs: [string, number, string, string, string][] = [
    ['Volume to treat', so.input.volumeL, 'L', 'Defaults to expected recovered volume', '0.00'],
    ['pH (measured)', so.input.pH, '', 'Measure. Do not estimate.', '0.00'],
    ['Current free SO₂', so.input.currentFreePpm, 'mg/L', 'From titration or a test kit (0 for a fresh ferment)', '0'],
    ['Current total SO₂', so.input.currentTotalPpm, 'mg/L', '', '0'],
    ['Target molecular SO₂', so.input.targetMolecularPpm, 'mg/L', '0.8 typical for light meads; 0.5 for tannic or red meads', '0.00'],
    ['Expected binding of addition', so.input.bindingPct / 100, '%', 'First addition after fermentation often loses 25–50 %', '0%'],
    ['SO₂ fraction of product', SULFITE_FORMS[so.input.form].so2Fraction, '', `${SULFITE_FORMS[so.input.form].label}: K-meta 0.576, Na-meta 0.674`, '0.000'],
    ['pKa1 of SO₂', SO2_PKA1, '', 'Aqueous value at 20 °C (conservative in alcohol)', '0.00'],
  ];
  inputs.forEach(([k, v, u, note, fmt], i) => {
    const rw = w.getRow(5 + i);
    rw.values = [k, v, u, note];
    rw.getCell(2).numFmt = fmt;
    rw.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.input } };
    bordered(rw);
  });
  w.getRow(14).values = ['Result', 'Value', 'Unit', 'Formula'];
  header(w.getRow(14));
  const results: [string, string, number, string, string, string][] = [
    ['Molecular fraction of free SO₂', '1/(1+10^(B6-B12))', so.molecularFraction, '', 'molecular = free / (1 + 10^(pH − pKa))', '0.00%'],
    ['Free SO₂ needed', 'B9/B15', so.requiredFreePpm, 'mg/L', 'target molecular ÷ molecular fraction', '0.0'],
    ['SO₂ to add', 'MAX(0,B16-B7)/(1-B10)', so.additionPpm, 'mg/L', '(needed − current free) ÷ (1 − binding)', '0.0'],
    ['SO₂ mass', 'B17*B5/1000', so.so2Grams, 'g', '', '0.000'],
    ['Product to add', 'B18/B11', so.productGrams, 'g', 'Dissolve in a little mead before adding', '0.00'],
    ['…as Campden tablets', `B18/${KMETA_SO2_FRACTION.toFixed(4)}/${CAMPDEN_KMETA_G}`, so.campdenTablets, 'tablets', `${CAMPDEN_KMETA_G} g K-meta per tablet. Check your brand.`, '0.0'],
    ['…as 10 % K-meta stock solution', `B18/(0.1*${KMETA_SO2_FRACTION.toFixed(4)})`, so.stockSolutionMl, 'mL', '10 g K-meta in 100 mL water', '0.0'],
    ['Free SO₂ after', 'B7+B17*(1-B10)', so.after.freePpm, 'mg/L', '', '0.0'],
    ['Total SO₂ after', 'MAX(B8,B7)+B17', so.after.totalPpm, 'mg/L', `Limits: US ${SO2_LIMIT_US_TOTAL} · EU mead ${SO2_LIMIT_EU_MEAD} mg/L`, '0.0'],
    ['Molecular SO₂ after', 'B22*B15', so.after.molecularPpm, 'mg/L', 'Aim 0.5–0.8. Above ~1.5 it can be smelt', '0.00'],
    ['Limit check', `IF(B23>${SO2_LIMIT_US_TOTAL},"Over US limit",IF(B23>${SO2_LIMIT_EU_MEAD},"Over EU mead limit","OK"))`, 0, '', '', ''],
  ];
  results.forEach(([k, formula, val, u, note, fmt], i) => {
    const rr = 15 + i;
    const rw = w.getRow(rr);
    const cached = k === 'Limit check' ? (so.after.totalPpm > SO2_LIMIT_US_TOTAL ? 'Over US limit' : so.after.totalPpm > SO2_LIMIT_EU_MEAD ? 'Over EU mead limit' : 'OK') : val;
    rw.values = [k, f(formula, cached), u, note];
    if (fmt) rw.getCell(2).numFmt = fmt;
    bordered(rw);
  });
  w.getCell('B19').font = { bold: true, color: { argb: C.title } };
  if (so.sorbate) {
    w.getCell('A28').value = 'Potassium sorbate (back-sweetening)';
    w.getCell('A28').font = { bold: true };
    w.getCell('B28').value = f('0.2*B5', so.sorbate.grams);
    w.getCell('B28').numFmt = '0.00';
    w.getCell('C28').value = 'g';
    w.getCell('D28').value = `0.2 g/L ≈ ${so.sorbate.sorbicPpm.toFixed(0)} mg/L sorbic acid (US max 300). Add with SO₂, never alone.`;
  }
  w.getCell('A30').value = 'Notes';
  w.getCell('A30').font = { bold: true };
  so.warnings.forEach((x, i) => {
    w.getCell(`A${31 + i}`).value = `${x.severity.toUpperCase()}: ${x.text}`;
    w.mergeCells(`A${31 + i}:D${31 + i}`);
    w.getCell(`A${31 + i}`).alignment = { wrapText: true };
    w.getRow(31 + i).height = 32;
  });

  // ── Advisor ────────────────────────────────────────────────────────────────
  const ad = wb.addWorksheet('Advisor');
  ad.columns = [{ width: 10 }, { width: 10 }, { width: 34 }, { width: 60 }, { width: 60 }, { width: 24 }];
  title(ad, "Mead Maker's Brain — advisories", stamp);
  ad.getRow(4).values = ['Severity', 'Area', 'Title', 'Detail', 'Suggestion', 'Sources'];
  header(ad.getRow(4));
  a.advisories.forEach((x, i) => {
    const rw = ad.getRow(5 + i);
    rw.values = [x.severity, x.category, x.title, x.detail, x.suggestion ?? '', x.source.map((id) => SOURCES[id]?.short ?? id).join(', ')];
    rw.alignment = { wrapText: true, vertical: 'top' };
    rw.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C[x.severity] } };
    bordered(rw);
  });
  let pr = 6 + a.advisories.length;
  section(ad, pr++, 'Pairing ideas');
  a.suggestions.forEach((x) => {
    ad.getRow(pr++).values = ['', '', `${x.forName} + ${x.partnerName}`, x.note, x.startDoseGPerL != null ? `Start at ${x.startDoseGPerL} g/L` : ''];
  });

  // ── Sources ────────────────────────────────────────────────────────────────
  const src = wb.addWorksheet('Sources');
  src.columns = [{ width: 18 }, { width: 22 }, { width: 70 }, { width: 18 }, { width: 70 }, { width: 40 }];
  title(src, 'Sources, licensing & usage', 'Formulas and facts are re-implemented and attributed; no third-party text is reproduced.');
  src.getRow(4).values = ['ID', 'Short', 'Citation', 'Licence status', 'How it is used', 'URL'];
  header(src.getRow(4));
  Object.values(SOURCES).forEach((x, i) => {
    const rw = src.getRow(5 + i);
    rw.values = [x.id, x.short, x.citation, x.license, x.usage, x.url ? { text: x.url, hyperlink: x.url } : ''];
    rw.alignment = { wrapText: true, vertical: 'top' };
    bordered(rw);
  });

  return wb;
}

/** Tab-separated summary that pastes cleanly into Google Sheets or Excel. */
export function toTsv(a: Analysis): string {
  const L: (string | number)[][] = [
    ['Mead Lab', a.recipe.name],
    [],
    ['Original gravity', a.og.toFixed(3)],
    ['Final gravity (predicted)', a.fg.fg.toFixed(3)],
    ['ABV (Alternative eq.) %', a.abv.toFixed(2)],
    ['Sweetness', a.sweetness],
    ['Must volume (L)', a.primary.volumeL.toFixed(2)],
    ['Water to add (L)', a.primary.waterL.toFixed(2)],
    [],
    ['Ingredient', 'Stage', 'Mass (kg)', '+ Points', 'PPG'],
    ...a.recipe.honeys.map((h) => [honeyById(h.honeyId).name + ' honey', 'Primary', h.massKg, (a.contributions.find((c) => c.key === h.uid)?.deltaPoints ?? 0).toFixed(1), (a.contributions.find((c) => c.key === h.uid)?.ppg ?? 0).toFixed(1)]),
    ...a.recipe.sugars.map((g) => [sugarById(g.sugarId).name, 'Primary', g.massKg, '', '']),
    ...a.recipe.fruits.map((fr) => [fruitById(fr.fruitId).name, fr.stage, fr.massKg, (a.contributions.find((c) => c.key === fr.uid)?.deltaPoints ?? 0).toFixed(1), '']),
    ...a.recipe.spices.map((sp) => [spiceById(sp.spiceId).name, 'Secondary', (sp.grams / 1000).toFixed(4), '', '']),
    [],
    ['Nutrient dose', 'When', 'Fermaid O (g)', 'Fermaid K (g)', 'DAP (g)'],
    ...a.schedule.doses.map((d) => [d.n, d.when, d.fermaidO.toFixed(2), d.fermaidK.toFixed(2), d.dap.toFixed(2)]),
    [],
    ['Sulfite', 'Value'],
    ['pH', a.sulfite.input.pH],
    ['Free SO2 needed (mg/L)', a.sulfite.requiredFreePpm.toFixed(1)],
    ['SO2 to add (mg/L)', a.sulfite.additionPpm.toFixed(1)],
    [`${SULFITE_FORMS[a.sulfite.input.form].label} (g)`, a.sulfite.productGrams.toFixed(2)],
    ['Total SO2 after (mg/L)', a.sulfite.after.totalPpm.toFixed(1)],
    ['Molecular SO2 after (mg/L)', a.sulfite.after.molecularPpm.toFixed(2)],
  ];
  return L.map((r) => r.join('\t')).join('\n');
}

export function fileName(a: Analysis) {
  return `${a.recipe.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'mead'}.xlsx`;
}
