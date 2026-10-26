/**
 * Excel / Google Sheets export — SPEC §14 (rebuilt after the export audit, §14.2).
 *
 * Design rules:
 *  - Every table has a header row; every value has a unit; no unnamed columns.
 *  - Yellow cells are inputs. Everything that can be expressed as a spreadsheet formula IS a live
 *    formula (with a cached result so previews show numbers before recalculation).
 *  - Values from the app's heavier models (must solver, acid–base pH model) are labelled
 *    "from the app" because a spreadsheet cannot recompute them.
 *  - Only functions that behave the same in Excel, Google Sheets and LibreOffice (IF, MAX, MIN,
 *    SUM, ISNUMBER, ROUND, AND); no dynamic arrays, no LET/IFS/XLOOKUP.
 */
import ExcelJS from 'exceljs';
export { ensureExcel } from './excel-loader';
import type { Analysis } from './recipe';
import { fruitById, honeyById, spiceById, sugarById } from './db';
import { doseBand } from './flavor';
import { honeyExtractFromDensity } from './must';
import { PROTOCOL_LABELS } from './nutrients';
import { SOURCES, LicenseStatus } from './sources';
import { SULFITE_FORMS } from './sulfite';
import { CAMPDEN_KMETA_G, DAP_LEGAL_MAX, KMETA_SO2_FRACTION, NAMETA_SO2_FRACTION, SO2_LIMIT_EU_MEAD, SO2_LIMIT_US_TOTAL } from './constants';
import { BASES } from './acidbase';
import { abv as abvFn } from './abv';

// ── Styling ──────────────────────────────────────────────────────────────────
const C = {
  title: 'FF78350F', header: 'FFFDE68A', input: 'FFFEF3C7', section: 'FF92400E', border: 'FFD6D3D1', muted: 'FF78716C',
  error: 'FFFEE2E2', warning: 'FFFFEDD5', tip: 'FFD1FAE5', info: 'FFF5F5F4', good: 'FFD1FAE5',
};
const thin = { style: 'thin' as const, color: { argb: C.border } };
const box = { top: thin, left: thin, bottom: thin, right: thin };
const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });

type Val = ExcelJS.CellValue;
const f = (formula: string, result: number | string | boolean): Val => ({ formula, result } as Val);
// Numbers are stored at FULL precision (display comes from number formats): rounding stored inputs made
// formulas drift from the app — caught by the LibreOffice recalculation audit (SPEC §14.2).
const r3 = (v: number) => v;
const r2 = (v: number) => v;

const LICENSE_LABEL: Record<LicenseStatus, string> = {
  'public-domain': 'Public domain', 'open-reuse': 'Open reuse with credit', 'facts-attributed': 'Facts only, cited',
  'logic-only': 'Logic only, no content copied', own: 'Our own',
};

/** Appends rows to a sheet and remembers where things landed, so formulas can reference them. */
class Sheet {
  row = 1;
  /** Which columns the current table names; unnamed spacer columns stay blank and unstyled. */
  private named: boolean[] = [];
  constructor(public ws: ExcelJS.Worksheet, widths: number[]) {
    ws.columns = widths.map((width) => ({ width }));
    ws.pageSetup = { orientation: widths.length > 6 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
  }
  title(text: string, sub: string) {
    const last = this.ws.columns.length;
    this.ws.mergeCells(1, 1, 1, last);
    const t = this.ws.getCell(1, 1);
    t.value = text;
    t.font = { size: 16, bold: true, color: { argb: C.title } };
    this.ws.getRow(1).height = 26;
    this.ws.mergeCells(2, 1, 2, last);
    const s = this.ws.getCell(2, 1);
    s.value = sub;
    s.font = { italic: true, color: { argb: C.muted } };
    s.alignment = { wrapText: true, vertical: 'top' };
    this.ws.getRow(2).height = 30;
    this.row = 4;
  }
  section(text: string, note?: string) {
    if (this.row > 4) this.row++;
    const c = this.ws.getCell(this.row, 1);
    c.value = text;
    c.font = { bold: true, size: 12, color: { argb: C.section } };
    if (note) {
      const last = this.ws.columns.length;
      this.ws.mergeCells(this.row + 1, 1, this.row + 1, last);
      const n = this.ws.getCell(this.row + 1, 1);
      n.value = note;
      n.font = { italic: true, size: 9, color: { argb: C.muted } };
      n.alignment = { wrapText: true };
      this.row++;
    }
    this.row++;
  }
  header(cols: string[], notes: Record<number, string> = {}, span?: [number, number]) {
    const rw = this.ws.getRow(this.row);
    rw.values = cols;
    this.named = cols.map((c) => c !== '');
    rw.eachCell((c, i) => {
      if (cols[i - 1] === '') return;
      c.font = { bold: true };
      c.fill = fill(C.header);
      c.border = box;
      c.alignment = { vertical: 'middle', wrapText: true };
      if (notes[i - 1]) c.note = notes[i - 1];
    });
    if (span) this.ws.mergeCells(this.row, span[0] + 1, this.row, span[1] + 1);
    this.row++;
  }
  /** Character width of columns a..b (0-based, inclusive). */
  private width(a: number, b: number) {
    let w = 0;
    for (let i = a; i <= b; i++) w += this.ws.getColumn(i + 1).width ?? 10;
    return w;
  }
  /** Write a row; returns its number. `fmt` maps 0-based column → number format. */
  add(values: Val[], opts: { fmt?: Record<number, string>; input?: number[]; bold?: boolean; wrap?: boolean; note?: Record<number, string>; span?: [number, number] } = {}): number {
    const n = this.row++;
    const rw = this.ws.getRow(n);
    rw.values = values;
    values.forEach((v, i) => {
      const c = rw.getCell(i + 1);
      if (v === '' && this.named.length && !this.named[i]) return;
      c.border = box;
      c.alignment = { vertical: 'top', wrapText: opts.wrap ?? true };
      if (opts.fmt?.[i]) c.numFmt = opts.fmt[i];
      if (opts.input?.includes(i)) c.fill = fill(C.input);
      if (opts.note?.[i]) c.note = opts.note[i];
      if (opts.bold) c.font = { bold: true };
    });
    if (opts.span) {
      // Merge AFTER writing values (assigning row values afterwards would undo the merge) and size
      // the row for the wrapped text, because spreadsheet apps don't auto-fit merged cells.
      const [a, b] = opts.span;
      const border = rw.getCell(a + 1).border;
      this.ws.mergeCells(n, a + 1, n, b + 1);
      rw.getCell(a + 1).border = border;
      let lines = 1;
      values.forEach((v, i) => {
        const w = i === a ? this.width(a, b) : this.width(i, i);
        if (typeof v === 'string' && (i < a || i === a)) lines = Math.max(lines, Math.ceil((v.length * 1.05) / Math.max(4, w - 1)));
      });
      rw.height = Math.max(15, 15 * lines);
    }
    return n;
  }
  note(text: string) {
    const last = this.ws.columns.length;
    this.ws.mergeCells(this.row, 1, this.row, last);
    const c = this.ws.getCell(this.row, 1);
    c.value = text;
    c.font = { italic: true, size: 9, color: { argb: C.muted } };
    c.alignment = { wrapText: true, vertical: 'top' };
    this.ws.getRow(this.row).height = Math.min(90, 14 * Math.ceil(text.length / 110) + 4);
    this.row++;
  }
  freeze(ySplit: number) { this.ws.views = [{ state: 'frozen', ySplit }]; }
}

const listValidation = (items: string[], prompt: string): ExcelJS.DataValidation => ({
  type: 'list', allowBlank: false, formulae: [`"${items.join(',')}"`], showErrorMessage: true, errorTitle: 'Pick from the list', error: `Choose one of: ${items.join(', ')}`, showInputMessage: true, promptTitle: 'Choose', prompt,
});
const rangeValidation = (min: number, max: number, what: string): ExcelJS.DataValidation => ({
  type: 'decimal', operator: 'between', allowBlank: true, formulae: [min, max], showErrorMessage: true, errorTitle: 'Out of range', error: `${what} should be between ${min} and ${max}.`,
});

const BAND_FORMULA = (dose: string, s: string, t: string, b: string, m: string) =>
  `IF(${dose}="","",IF(${dose}>3*${m},"check units",IF(${dose}>${m},"far too much",IF(${dose}>${b},"assertive",IF(${dose}>=${t},IF(${dose}>(${t}+${b})/2,"bold","typical"),IF(${dose}>=${s},"subtle","barely noticeable"))))))`;
const BAND_LABEL: Record<string, string> = {
  imperceptible: 'barely noticeable', subtle: 'subtle', typical: 'typical', bold: 'bold', assertive: 'assertive', astronomical: 'far too much', 'unit-error': 'check units',
};
function bandColours(ws: ExcelJS.Worksheet, ref: string) {
  ws.addConditionalFormatting({
    ref,
    rules: [
      { type: 'containsText', operator: 'containsText', text: 'far too much', priority: 1, style: { fill: fill('FFFCA5A5'), font: { bold: true } } },
      { type: 'containsText', operator: 'containsText', text: 'check units', priority: 2, style: { fill: fill('FFFCA5A5'), font: { bold: true } } },
      { type: 'containsText', operator: 'containsText', text: 'assertive', priority: 3, style: { fill: fill('FFFDBA74') } },
      { type: 'containsText', operator: 'containsText', text: 'typical', priority: 4, style: { fill: fill('FF86EFAC') } },
      { type: 'containsText', operator: 'containsText', text: 'subtle', priority: 5, style: { fill: fill('FFBBF7D0') } },
      { type: 'containsText', operator: 'containsText', text: 'bold', priority: 6, style: { fill: fill('FFFDE68A') } },
    ],
  });
}

const sweetnessOf = (fg: number) => (fg <= 1.006 ? 'Dry' : fg <= 1.015 ? 'Semi-sweet' : fg <= 1.025 ? 'Sweet' : 'Dessert');
const strengthOf = (abv: number) => (abv < 3.5 ? 'Below hydromel' : abv < 7.5 ? 'Hydromel' : abv <= 14 ? 'Standard' : abv <= 18 ? 'Sack' : 'Beyond sack');
const brix = (sg: number) => (258.6 * (sg - 1)) / (1 + (227.1 / 258.2) * (sg - 1));
const OIV_PKA_FORMULA = (abv: string) =>
  `IF(${abv}<=5,1.723+MAX(0,${abv})/5*0.096,IF(${abv}<=10,1.819+(${abv}-5)/5*0.097,IF(${abv}<=15,1.916+(${abv}-10)/5*0.098,2.014+(MIN(${abv},20)-15)/5*0.1)))`;

export interface ExportOptions { generated?: Date; versionLabel?: string }

export function buildWorkbook(a: Analysis, opts: ExportOptions = {}): ExcelJS.Workbook {
  const r = a.recipe;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Mead Lab';
  wb.created = opts.generated ?? new Date();
  wb.calcProperties = { fullCalcOnLoad: true };
  const date = wb.created.toISOString().slice(0, 10);
  const version = opts.versionLabel ?? 'Not saved to the library';
  const shortVersion = version.startsWith(r.name) ? version.slice(r.name.length).trim() || version : version;
  const sub = `${r.name} · ${shortVersion} · exported ${date} · yellow cells are inputs you can change`;

  // Sheet order (Read me first); created up front so hyperlinks resolve
  const readme = new Sheet(wb.addWorksheet('Read me'), [24, 70]);
  const sum = new Sheet(wb.addWorksheet('Summary'), [34, 16, 12, 14, 56]);
  const ing = new Sheet(wb.addWorksheet('Ingredients'), [11, 28, 11, 11, 11, 11, 11, 11, 10, 11, 9, 9, 9, 9, 15, 46]);
  const nut = new Sheet(wb.addWorksheet('Nutrients'), [6, 40, 20, 14, 14, 16, 16]);
  const acid = new Sheet(wb.addWorksheet('Acidity'), [36, 14, 14, 14, 14, 30]);
  const so2 = new Sheet(wb.addWorksheet('Sulfite'), [38, 24, 12, 60]);
  const adv = new Sheet(wb.addWorksheet('Advisor'), [12, 12, 34, 60, 60, 24]);
  const hasLog = !!(r.log?.pitchedAt || r.log?.readings?.length);
  const log = hasLog ? new Sheet(wb.addWorksheet('Log'), [22, 10, 9, 14, 14, 36]) : null;
  const src = new Sheet(wb.addWorksheet('Sources'), [22, 70, 22, 60, 40]);

  // ── Summary ────────────────────────────────────────────────────────────────
  sum.title(`Mead Lab: ${r.name}`, sub);
  sum.section('Recipe');
  sum.header(['Item', 'Value', 'Unit', 'US units', 'Notes']);
  sum.add(['Name', r.name, '', '', ''], { span: [1, 3] });
  sum.add(['Saved version', shortVersion, '', '', 'From the app\'s recipe library. Editing this file does not change saved recipes.'], { span: [1, 3] });
  sum.add(['Must volume', r2(a.primary.volumeL), 'L', f(`B${sum.row}/3.785411784`, r2(a.primary.volumeL / 3.785411784)), 'Liquid volume after fruit has released its juice'], { fmt: { 1: '0.00', 3: '0.00 "gal"' } });
  sum.add(['Yeast', a.yeast.name, '', '', `${a.yeast.tolerance} % alcohol tolerance · ${a.demand} nitrogen demand · ${a.yeast.tempC[0]}–${a.yeast.tempC[1]} °C`], { span: [1, 3] });
  sum.add(['Nutrient protocol', PROTOCOL_LABELS[r.protocol], '', '', 'See the Nutrients sheet'], { span: [1, 3] });
  sum.add(['Water alkalinity', r.alkalinityCaCO3 ?? 50, 'mg/L CaCO₃', '', '0 = RO/distilled · 50 spring · 100 tap · 250 hard'], { fmt: { 1: '0' } });
  sum.add(['Planned finish', r.targetFg != null ? r.targetFg : 'Ferment to the yeast limit', r.targetFg != null ? 'SG' : '', '', r.targetFg != null ? 'Stabilise and stop or back-sweeten at this gravity' : ''], { fmt: { 1: '0.000' } });

  sum.section('Gravity & alcohol', 'Type your hydrometer readings into the yellow cells. ABV, sweetness and strength then switch from the prediction to your measurements.');
  sum.header(['Measure', 'Value', 'Unit', 'Brix / other', 'Notes']);
  const ogPredRow = sum.add(['Original gravity: predicted', r3(a.og), 'SG', r2(brix(a.og)), 'Calculated from the recipe by mass balance (from the app)'], { fmt: { 1: '0.000', 3: '0.0 "°Bx"' } });
  const ogEffRow = sum.add(['Effective OG incl. secondary fruit', r3(a.effectiveOg), 'SG', '', a.hasSecondaryFruit ? 'Secondary fruit adds sugar after the OG reading; used for ABV' : 'Same as above (no fruit in secondary)'], { fmt: { 1: '0.000' } });
  const fgPredRow = sum.add(['Final gravity: predicted', r3(a.fg.fg), 'SG', '', a.fg.limitedBy === 'yeast' ? 'Limited by yeast alcohol tolerance' : a.fg.limitedBy === 'target' ? 'Your planned finish' : 'Ferments dry'], { fmt: { 1: '0.000' } });
  const ogMeasRow = sum.add(['Your measured OG', '', 'SG', '', 'Optional: your hydrometer reading before pitching'], { fmt: { 1: '0.000' }, input: [1] });
  const fgMeasRow = sum.add(['Your measured FG', '', 'SG', '', 'Optional: your reading when fermentation has finished'], { fmt: { 1: '0.000' }, input: [1] });
  sum.ws.getCell(`B${ogMeasRow}`).dataValidation = rangeValidation(0.99, 1.2, 'OG');
  sum.ws.getCell(`B${fgMeasRow}`).dataValidation = rangeValidation(0.98, 1.2, 'FG');
  const og = a.effectiveOg, fg = a.fg.fg;
  const ogUsedRow = sum.add(['OG used below', f(`IF(ISNUMBER(B${ogMeasRow}),B${ogMeasRow},B${ogEffRow})`, r3(og)), 'SG', '', 'Your measured OG if entered, otherwise the prediction'], { fmt: { 1: '0.000' } });
  const fgUsedRow = sum.add(['FG used below', f(`IF(ISNUMBER(B${fgMeasRow}),B${fgMeasRow},B${fgPredRow})`, r3(fg)), 'SG', '', 'Your measured FG if entered, otherwise the prediction'], { fmt: { 1: '0.000' } });
  const OG = `B${ogUsedRow}`, FG = `B${fgUsedRow}`;
  // Nutrients, pitch rate and sugar breaks concern the PRIMARY must (secondary fruit isn't in it yet)
  const primOgRow = sum.add(['Primary OG used for nutrients', f(`IF(ISNUMBER(B${ogMeasRow}),B${ogMeasRow},B${ogPredRow})`, a.og), 'SG', '', 'Your measured OG if entered, otherwise the predicted primary OG'], { fmt: { 1: '0.000' } });
  const PO = `B${primOgRow}`;
  const abvVal = og > fg ? abvFn(og, fg) : 0;
  const abvRow = sum.add(['ABV (Alternative equation)', f(`IF(${OG}>${FG},(76.08*(${OG}-${FG})/(1.775-${OG}))*(${FG}/0.794),0)`, r2(abvVal)), '% v/v', '', 'Hall (1995): [76.08 × (OG − FG) / (1.775 − OG)] × [FG / 0.794]'], { fmt: { 1: '0.00' }, bold: true });
  sum.add(['ABW (alcohol by weight)', f(`IF(${OG}>${FG},76.08*(${OG}-${FG})/(1.775-${OG}),0)`, r2(og > fg ? (76.08 * (og - fg)) / (1.775 - og) : 0)), '% w/w', '', 'First half of the equation above'], { fmt: { 1: '0.00' } });
  sum.add(['Sweetness', f(`IF(${FG}<=1.006,"Dry",IF(${FG}<=1.015,"Semi-sweet",IF(${FG}<=1.025,"Sweet","Dessert")))`, sweetnessOf(fg)), '', '', 'Dry ≤ 1.006 · Semi-sweet ≤ 1.015 · Sweet ≤ 1.025 · Dessert above'], {});
  sum.add(['Residual sugar (estimate)', f(`MAX(0,(${FG}-${r.dryFg})*1000*2.6)`, r2(Math.max(0, (fg - r.dryFg) * 1000 * 2.6))), 'g/L', '', `About 2.6 g/L per gravity point above a dry finish of ${r.dryFg}`], { fmt: { 1: '0' } });
  sum.add(['Strength', f(`IF(B${abvRow}<3.5,"Below hydromel",IF(B${abvRow}<7.5,"Hydromel",IF(B${abvRow}<=14,"Standard",IF(B${abvRow}<=18,"Sack","Beyond sack"))))`, strengthOf(abvVal)), '', '', 'Hydromel 3.5–7.5 · Standard 7.5–14 · Sack 14–18 % ABV'], {});
  const breakRow = sum.add(['⅓ sugar break', f(`${PO}-(${PO}-${FG})/3`, a.og - (a.og - fg) / 3), 'SG', '', 'Trigger for the 4th nutrient addition (primary OG to the FG used)'], { fmt: { 1: '0.000' } });
  sum.add(['½ sugar break', f(`${PO}-(${PO}-${FG})/2`, a.og - (a.og - fg) / 2), 'SG', '', ''], { fmt: { 1: '0.000' } });

  sum.section('Acidity (predicted by the app)', 'From the app\'s acid–base model (±0.2 pH). A spreadsheet can\'t recompute it, so measure with a pH meter. Details are on the Acidity sheet.');
  sum.header(['Measure', 'Value', 'Unit', '', 'Notes']);
  sum.add(['pH of the must (before fermentation)', r2(a.ph.mustPh), 'pH', '', 'Below 3.0 stresses yeast'], { fmt: { 1: '0.00' } });
  sum.add(['pH of the finished mead', r2(a.ph.finishedPh), 'pH', '', 'Typical meads 3.3–3.6; above 3.8 SO₂ works poorly'], { fmt: { 1: '0.00' } });
  sum.add(['Titratable acidity: must', Number(a.ph.mustTa.toFixed(1)), 'g/L', '', 'As tartaric acid'], { fmt: { 1: '0.0' } });
  sum.add(['Titratable acidity: finished', Number(a.ph.finishedTa.toFixed(1)), 'g/L', '', 'As tartaric acid, after yeast acids'], { fmt: { 1: '0.0' } });

  sum.section('Volumes & yield (from the app)');
  sum.header(['Measure', 'Litres', '', 'US gallons', 'Notes']);
  const vol = (label: string, l: number, note: string) => sum.add([label, r2(l), 'L', f(`B${sum.row}/3.785411784`, r2(l / 3.785411784)), note], { fmt: { 1: '0.00', 3: '0.00' } });
  vol('Water to add', a.primary.waterL, 'Solved so the must reaches the target volume');
  vol('Total incl. secondary fruit juice', a.whole.volumeL, '');
  vol('Fermenter space on day 0', a.occupancy.day0L, 'Liquid plus intact whole fruit');
  vol('Recommended fermenter size', a.occupancy.recommendedFermenterL, `Includes ${(a.occupancy.headspaceFraction * 100).toFixed(0)} % headspace`);
  const recRow = vol('Expected volume after racking', a.occupancy.recoveredL, `After ${a.occupancy.fruitRetainedL.toFixed(2)} L lost to fruit pulp and ${a.occupancy.leesLossL.toFixed(2)} L to lees`);
  sum.add(['Bottles: 750 mL', f(`INT(B${recRow}/0.75)`, Math.floor(a.occupancy.recoveredL / 0.75)), 'bottles', '', 'From the expected volume above'], { fmt: { 1: '0' } });
  sum.add(['Bottles: 375 mL', f(`INT(B${recRow}/0.375)`, Math.floor(a.occupancy.recoveredL / 0.375)), 'bottles', '', ''], { fmt: { 1: '0' } });

  sum.section('Predicted profile (from the app)');
  const noteRow = sum.row;
  sum.ws.mergeCells(noteRow, 1, noteRow, 5);
  sum.ws.getCell(noteRow, 1).value = a.tastingNote;
  sum.ws.getCell(noteRow, 1).alignment = { wrapText: true, vertical: 'top' };
  sum.ws.getCell(noteRow, 1).font = { italic: true };
  sum.ws.getRow(noteRow).height = 48;
  sum.row++;
  const colourRow = sum.add(['Estimated colour', a.color.name, '', '', 'Swatch in column B, for illustration only']);
  sum.ws.getCell(`B${colourRow}`).fill = fill('FF' + a.color.hex.slice(1).toUpperCase());
  sum.ws.getCell(`B${colourRow}`).font = { color: { argb: parseInt(a.color.hex.slice(1, 3), 16) < 128 ? 'FFFFFFFF' : 'FF000000' } };
  sum.header(['Taste axis', 'Score', 'Scale', '', 'Meaning']);
  const AXIS_NOTE: Record<string, string> = {
    Sweetness: 'From the finishing gravity', Acidity: 'From finished titratable acidity', Body: 'Sweetness, alcohol and fruit',
    Warmth: 'Alcohol heat', Tannin: 'From fruit skins, oak, cacao and coffee', Fruit: 'Fruit doses against their typical dose',
    Spice: 'Spices and adjuncts against their typical dose', Floral: 'Flowers and herbs', Honey: 'Honey character after masking',
  };
  for (const [k, v] of Object.entries(a.profile)) sum.add([k, Number(v.toFixed(1)), '/ 10', '', AXIS_NOTE[k] ?? ''], { fmt: { 1: '0.0' } });
  sum.freeze(3);
  const S = (cell: string) => `'Summary'!${cell}`;

  // ── Ingredients ────────────────────────────────────────────────────────────
  ing.title('Ingredients', sub);
  ing.section('Batch');
  ing.header(['Item', 'Value', 'Unit', 'Notes'], {}, [3, 15]);
  const doseVolRow = ing.add(['Dose volume', r2(a.whole.volumeL), 'L', 'Final liquid volume (incl. secondary juice). Doses per litre below use this cell, so change it to rescale.'], { fmt: { 1: '0.00' }, input: [1], span: [3, 15] });
  const DV = `$B$${doseVolRow}`;
  ing.section('Fermentables & fruit', 'Mass is an input: sugar and dose update when you change it. "OG points" and "PPG" come from the app\'s mass-balance solver at the recipe values.');
  ing.header(['Type', 'Ingredient', 'Stage', 'Mass (kg)', 'Mass (lb)', 'Sugar fraction', 'Sugar (kg)', 'OG points added', 'PPG', 'Dose (kg/L)', 'Subtle', 'Typical', 'Bold', 'Max', 'Dose band', 'Notes'],
    { 5: 'Fraction of the weighed mass that ends up as dissolved sugar', 7: 'How much this ingredient raises the OG at the recipe volume', 8: 'Gravity points per pound per US gallon', 9: 'Fruit only: kg per litre of final volume', 14: 'Where the fruit sits on its own intensity scale' });
  const firstIng = ing.row;
  const contrib = new Map(a.contributions.map((c) => [c.key, c]));
  const fermFmt = { 3: '0.000', 4: '0.00', 5: '0.000', 6: '0.000', 7: '0.0', 8: '0.0', 9: '0.000', 10: '0.00', 11: '0.00', 12: '0.00', 13: '0.00' };
  for (const h of r.honeys) {
    const x = honeyById(h.honeyId), c = contrib.get(h.uid), frac = honeyExtractFromDensity(x.density), n = ing.row;
    ing.add(['Honey', x.name, 'Primary', h.massKg, f(`D${n}/0.45359237`, r2(h.massKg / 0.45359237)), r3(frac), f(`D${n}*F${n}`, r3(h.massKg * frac)), c ? r2(c.deltaPoints) : '', c ? r2(c.ppg) : '', '', '', '', '', '', '', x.character], { fmt: fermFmt, input: [3] });
  }
  for (const g of r.sugars) {
    const x = sugarById(g.sugarId), c = contrib.get(g.uid), n = ing.row;
    ing.add(['Sugar', x.name, 'Primary', g.massKg, f(`D${n}/0.45359237`, r2(g.massKg / 0.45359237)), x.purity, f(`D${n}*F${n}`, r3(g.massKg * x.purity)), c ? r2(c.deltaPoints) : '', c ? r2(c.ppg) : '', '', '', '', '', '', '', `${x.purity * 100} % fermentable`], { fmt: fermFmt, input: [3] });
  }
  for (const fr of r.fruits) {
    const x = fruitById(fr.fruitId), c = contrib.get(fr.uid), n = ing.row, frac = ((1 - x.insoluble) * x.brix) / 100;
    const dose = a.whole.volumeL > 0 ? fr.massKg / a.whole.volumeL : 0;
    ing.add(['Fruit', x.name, fr.stage === 'primary' ? 'Primary' : 'Secondary', fr.massKg, f(`D${n}/0.45359237`, r2(fr.massKg / 0.45359237)), r3(frac), f(`D${n}*F${n}`, r3(fr.massKg * frac)),
      c ? r2(c.deltaPoints) : 'not in OG', c ? r2(c.ppg) : '—', f(`D${n}/${DV}`, r3(dose)), x.subtle, x.typical, x.bold, x.max,
      f(BAND_FORMULA(`J${n}`, `K${n}`, `L${n}`, `M${n}`, `N${n}`), BAND_LABEL[doseBand(x, dose)]),
      `${x.brix} °Bx · TA ${x.ta} g/L ${x.acid} · juice pH ${x.ph}. ${x.notes}`], { fmt: fermFmt, input: [3] });
  }
  const lastIng = ing.row - 1;
  const tot = (col: string, v: number) => f(`SUM(${col}${firstIng}:${col}${lastIng})`, r3(v));
  ing.add(['Total', '', '', tot('D', [...r.honeys, ...r.sugars, ...r.fruits].reduce((s, x) => s + x.massKg, 0)), tot('E', [...r.honeys, ...r.sugars, ...r.fruits].reduce((s, x) => s + x.massKg / 0.45359237, 0)), '',
    tot('G', a.contributions.reduce((s, c) => s + c.sugarKg, 0) + r.fruits.filter((x) => x.stage === 'secondary').reduce((s, x) => { const fx = fruitById(x.fruitId); return s + (x.massKg * (1 - fx.insoluble) * fx.brix) / 100; }, 0)),
    '', '', '', '', '', '', '', '', ''], { fmt: { 3: '0.000', 4: '0.00', 6: '0.000' }, bold: true });
  bandColours(ing.ws, `O${firstIng}:O${lastIng}`);

  ing.section('Spices, flowers, herbs & adjuncts', 'Grams are inputs. g/L and the dose band update live. Bands are practitioner consensus, so taste as you go.');
  ing.header(['Group', 'Botanical', 'Amount (g)', 'Amount (oz)', 'Dose (g/L)', 'Subtle', 'Typical', 'Bold', 'Max', 'Dose band', 'Contact (days)', 'Notes'],
    { 4: 'Grams per litre of final volume (dose volume above)', 9: 'Where the dose sits on this botanical\'s scale' }, [11, 15]);
  const firstBot = ing.row;
  for (const sp of r.spices) {
    const x = spiceById(sp.spiceId), n = ing.row, dose = a.whole.volumeL > 0 ? sp.grams / a.whole.volumeL : 0;
    const group = { spice: 'Spice', floral: 'Flower', herb: 'Herb', adjunct: 'Adjunct' }[x.group];
    ing.add([group, x.name, sp.grams, f(`C${n}/28.349523125`, r3(sp.grams / 28.349523125)), f(`C${n}/${DV}`, r3(dose)), x.subtle, x.typical, x.bold, x.max,
      f(BAND_FORMULA(`E${n}`, `F${n}`, `G${n}`, `H${n}`, `I${n}`), BAND_LABEL[doseBand(x, dose)]), `${x.contactDays[0]}–${x.contactDays[1]}`, `${x.form}. ${x.notes}`],
    { fmt: { 2: '0.0', 3: '0.000', 4: '0.000', 5: '0.00', 6: '0.00', 7: '0.00', 8: '0.00' }, input: [2], span: [11, 15] });
  }
  if (r.spices.length === 0) ing.add(['—', 'None in this recipe', '', '', '', '', '', '', '', '', '', ''], { span: [11, 15] });
  else bandColours(ing.ws, `J${firstBot}:J${ing.row - 1}`);

  ing.section('Acid & buffer additions');
  ing.header(['Type', 'Addition', 'Stage', 'Amount (g)', 'Dose (g/L)', 'Finished pH change', 'Notes'], { 5: 'From the app\'s acid–base model' }, [6, 15]);
  const adjs = (r.adjustments ?? []).filter((x) => x.grams > 0);
  adjs.forEach((x, i) => {
    const n = ing.row, c = a.ph.contributions.find((k) => k.key === `adj-${i}`);
    const isBase = x.id in BASES;
    ing.add([isBase ? 'Buffer' : 'Acid', isBase ? BASES[x.id as keyof typeof BASES].label : `${x.id[0].toUpperCase()}${x.id.slice(1)} acid`, x.stage === 'must' ? 'Must' : 'Finished mead', x.grams, f(`D${n}/${DV}`, r3(x.grams / a.whole.volumeL)), c ? r2(c.deltaFinished) : '', isBase ? 'Raises pH' : 'Lowers pH, raises acidity'], { fmt: { 3: '0.0', 4: '0.00', 5: '+0.00;-0.00;0.00' }, span: [6, 15] });
  });
  if (adjs.length === 0) ing.add(['—', 'None in this recipe', '', '', '', '', ''], { span: [6, 15] });
  ing.freeze(3);

  // ── Nutrients ──────────────────────────────────────────────────────────────
  nut.title('Yeast nutrition: staggered additions', sub);
  nut.section('Inputs', 'YAN target = Brix × 10 × demand factor − fruit credit. Change the yellow cells and the schedule below recalculates.');
  nut.header(['', 'Item', 'Value', 'Unit', 'Notes'], {}, [4, 6]);
  const brixRow = nut.add(['', 'Must sugar (Brix)', f(`258.6*(${S(PO)}-1)/(1+0.879551*(${S(PO)}-1))`, brix(a.og)), '°Bx', 'From the primary OG on the Summary sheet'], { fmt: { 2: '0.0' } , span: [4, 6] });
  const DEMAND = ['low', 'medium', 'high', 'very high'];
  const demandRow = nut.add(['', 'Yeast nitrogen demand', a.demand === 'veryHigh' ? 'very high' : a.demand, '', `${a.yeast.name}'s class. Pick another to override`], { input: [2], span: [4, 6] });
  nut.ws.getCell(`C${demandRow}`).dataValidation = listValidation(DEMAND, 'Nitrogen demand of your yeast strain');
  const factorRow = nut.add(['', 'Demand factor', f(`IF(C${demandRow}="low",0.75,IF(C${demandRow}="medium",0.9,IF(C${demandRow}="high",1.25,1.5)))`, a.yan.factor), '×', 'Low 0.75 · medium 0.90 · high 1.25 · very high 1.50'], { fmt: { 2: '0.00' } , span: [4, 6] });
  const creditRow = nut.add(['', 'Fruit YAN credit', r2(a.yan.creditPpm), 'mg N/L', 'Nitrogen your fruit supplies (0 = not counted)'], { fmt: { 2: '0' }, input: [2] , span: [4, 6] });
  const yanRow = nut.add(['', 'YAN target', f(`MAX(0,C${brixRow}*10*C${factorRow}-C${creditRow})`, r2(a.yan.netPpm)), 'mg N/L', 'Yeast-assimilable nitrogen to add in total'], { fmt: { 2: '0' }, bold: true , span: [4, 6] });
  const nVolRow = nut.add(['', 'Must volume', r2(a.schedule.volumeL), 'L', 'Volume the nutrients are dosed into'], { fmt: { 2: '0.00' }, input: [2] , span: [4, 6] });
  const PROTOS = ['TOSNA 3.0', 'Fermaid K + DAP', 'Hybrid O to K'];
  const protoRow = nut.add(['', 'Protocol', { tosna3: PROTOS[0], kDap: PROTOS[1], oK: PROTOS[2] }[r.protocol], '', 'TOSNA 3.0: Fermaid O only · K + DAP: inorganic early · Hybrid: Fermaid O then K'], { input: [2], span: [4, 6] });
  nut.ws.getCell(`C${protoRow}`).dataValidation = listValidation(PROTOS, 'Nutrient protocol');
  const V = `$C$${nVolRow}`, Y = `$C$${yanRow}`, P = `$C$${protoRow}`;
  const yeastRow = nut.add(['', 'Yeast to pitch', f(`IF(${S(PO)}>1.12,MAX(2/3.785411784*${V},${V}),2/3.785411784*${V})`, r2(a.rehydration.yeastG)), 'g', '2 g per US gallon; 1 g/L above OG 1.120'], { fmt: { 2: '0.0' } , span: [4, 6] });
  const gofermRow = nut.add(['', 'Go-Ferm (rehydration nutrient)', f(`C${yeastRow}*1.25`, r2(a.rehydration.goFermG)), 'g', '1.25 × the yeast weight'], { fmt: { 2: '0.0' } , span: [4, 6] });
  nut.add(['', 'Rehydration water', f(`C${gofermRow}*20`, a.rehydration.waterMl), 'mL', 'At 43 °C; 20 × the Go-Ferm weight'], { fmt: { 2: '0' } , span: [4, 6] });
  nut.section('Schedule', 'Add each dose after degassing. Never add DAP at or after the ⅓ sugar break.');
  nut.header(['#', 'When', 'Fermaid O (g)', 'Fermaid K (g)', 'DAP (g)', 'YAN delivered (mg/L)', 'SG trigger'],
    { 2: 'Counted at 160 mg N/L per g/L (40 label × 4 organic factor)', 3: '100 mg N/L per g/L', 4: '210 mg N/L per g/L', 6: 'Dose 4 goes in at this gravity, or on day 7, whichever comes first' });
  const firstDose = nut.row;
  a.schedule.doses.forEach((d, i) => {
    const n = nut.row, k = i + 1;
    const O = `IF(${P}="${PROTOS[0]}",${Y}/160*${V}/4,IF(AND(${P}="${PROTOS[2]}",${k}<=2),${Y}/4/160*${V},0))`;
    const K = `IF(${P}="${PROTOS[1]}",0.5*${Y}/100*${V}/4,IF(AND(${P}="${PROTOS[2]}",${k}>=3),${Y}/4/100*${V},0))`;
    const D = `IF(AND(${P}="${PROTOS[1]}",${k}<=3),0.5*${Y}/210*${V}/3,0)`;
    nut.add([d.n, d.when, f(O, r2(d.fermaidO)), f(K, r2(d.fermaidK)), f(D, r2(d.dap)), f(`IF(${V}>0,(C${n}*160+D${n}*100+E${n}*210)/${V},0)`, d.ppm),
      k === 4 ? f(S(`B${breakRow}`), a.og - (a.og - fg) / 3) : ''], { fmt: { 2: '0.00', 3: '0.00', 4: '0.00', 5: '0', 6: '0.000' } });
  });
  const lastDose = nut.row - 1;
  const totRow = nut.add(['', 'Total', f(`SUM(C${firstDose}:C${lastDose})`, r2(a.schedule.totals.fermaidO)), f(`SUM(D${firstDose}:D${lastDose})`, r2(a.schedule.totals.fermaidK)), f(`SUM(E${firstDose}:E${lastDose})`, r2(a.schedule.totals.dap)), f(`SUM(F${firstDose}:F${lastDose})`, a.schedule.totals.ppm), ''], { fmt: { 2: '0.00', 3: '0.00', 4: '0.00', 5: '0' }, bold: true });
  const dapCheck = a.schedule.volumeL > 0 && a.schedule.totals.dap / a.schedule.volumeL > DAP_LEGAL_MAX ? 'Over the US limit' : 'Within the US limit';
  const dapRow = nut.add(['', 'DAP legal check', f(`IF(E${totRow}/${V}>${DAP_LEGAL_MAX},"Over the US limit","Within the US limit")`, dapCheck), `US limit ${DAP_LEGAL_MAX} g/L (27 CFR 24.246)`], { span: [3, 6] });
  nut.ws.addConditionalFormatting({ ref: `C${dapRow}`, rules: [{ type: 'containsText', operator: 'containsText', text: 'Over', priority: 1, style: { fill: fill('FFFCA5A5'), font: { bold: true } } }] });
  nut.note('Fermaid®, Go-Ferm® and Lalvin® are trademarks of Lallemand Inc., named only to identify the products. TOSNA protocol credited to S. Moutela.');
  nut.freeze(3);

  // ── Acidity ────────────────────────────────────────────────────────────────
  acid.title('Acidity & pH (predicted by the app)', sub);
  acid.note('These numbers come from the app\'s acid–base model: a charge balance over every acid and mineral in the recipe, calibrated against two published mead studies (typical error 0.02, shown as ±0.2 because honey varies). A spreadsheet can\'t recalculate them, so measure with a calibrated pH meter.');
  acid.section('Overview');
  acid.header(['Measure', 'Must', 'Finished', 'Unit', 'Notes'], {}, [4, 5]);
  acid.add(['pH', a.ph.mustPh, a.ph.finishedPh, 'pH', 'Typical finished mead 3.3–3.6'], { fmt: { 1: '0.00', 2: '0.00' }, span: [4, 5] });
  acid.add(['Titratable acidity', a.ph.mustTa, a.ph.finishedTa, 'g/L tartaric', 'Rises in fermentation as yeast make succinic and acetic acid'], { fmt: { 1: '0.0', 2: '0.0' }, span: [4, 5] });
  acid.add(['Yeast-made succinic acid', '—', a.ph.succinicGPerL, 'g/L', 'Scales with the sugar fermented'], { fmt: { 2: '0.00' }, span: [4, 5] });
  acid.add(['Water alkalinity', r.alkalinityCaCO3 ?? 50, '—', 'mg/L CaCO₃', 'Bicarbonate neutralises acid and raises pH'], { fmt: { 1: '0' }, span: [4, 5] });
  acid.section('What moves the pH', 'Recipe with the ingredient minus recipe without it. Negative = more acidic. A fruit can lower the must pH but raise the finished pH, because its buffer resists the acids yeast make.');
  acid.header(['Ingredient', 'Must ΔpH', 'Finished ΔpH']);
  for (const c of a.ph.contributions) acid.add([c.label, c.deltaMust, c.deltaFinished], { fmt: { 1: '+0.00;-0.00;0.00', 2: '+0.00;-0.00;0.00' } });
  if (a.fruitPhCurves.length) {
    acid.section('Fruit dose → finished pH', 'Finished pH of this recipe if the fruit were used at each point of its dose scale (other ingredients unchanged).');
    acid.header(['Fruit', 'Subtle', 'Typical', 'Bold', 'Max', 'Dose at each point (kg/L)']);
    for (const c of a.fruitPhCurves) {
      const fr = r.fruits.find((x) => x.uid === c.uid);
      const name = fr ? fruitById(fr.fruitId).name : c.uid;
      acid.add([name, ...c.points.map((p) => r2(p.finishedPh)), c.points.map((p) => `${p.band} ${p.kgPerL}`).join(' · ')], { fmt: { 1: '0.00', 2: '0.00', 3: '0.00', 4: '0.00' } });
    }
  }
  acid.freeze(3);

  // ── Sulfite (live calculator) ──────────────────────────────────────────────
  const so = a.sulfite;
  so2.title('Sulfite & stabilisation: live calculator', `${sub}. Change any yellow cell and everything recalculates.`);
  so2.section('Inputs');
  so2.header(['Input', 'Value', 'Unit', 'Notes']);
  const sVol = so2.add(['Volume to treat', r2(so.input.volumeL), 'L', 'Defaults to the expected volume after racking'], { fmt: { 1: '0.00' }, input: [1] });
  const sPh = so2.add(['pH', r2(so.input.pH), 'pH', a.recipe.sulfite?.usePredictedPh === false ? 'Your measured value' : 'Predicted by the app (±0.2). Replace with your meter reading.'], { fmt: { 1: '0.00' }, input: [1] });
  so2.ws.getCell(`B${sPh}`).dataValidation = rangeValidation(2.6, 4.6, 'pH');
  const sAbv = so2.add(['ABV of the mead', f(S(`B${abvRow}`), r2(abvVal)), '% v/v', 'Linked to Summary. Alcohol raises the SO₂ pKa (OIV table)'], { fmt: { 1: '0.0' }, input: [1] });
  const sFree = so2.add(['Current free SO₂', so.input.currentFreePpm, 'mg/L', 'From a test kit or titration (0 for a fresh ferment)'], { fmt: { 1: '0' }, input: [1] });
  const sTot = so2.add(['Current total SO₂', so.input.currentTotalPpm, 'mg/L', ''], { fmt: { 1: '0' }, input: [1] });
  const sMol = so2.add(['Target molecular SO₂', so.input.targetMolecularPpm, 'mg/L', '0.8 for light, fruity or sweet meads · 0.5 for tannic or red meads'], { fmt: { 1: '0.00' }, input: [1] });
  so2.ws.getCell(`B${sMol}`).dataValidation = rangeValidation(0.2, 2, 'Molecular SO₂');
  const sBind = so2.add(['Expected binding of this addition', so.input.bindingPct / 100, '%', 'The first addition after fermentation often loses 25–50 %'], { fmt: { 1: '0%' }, input: [1] });
  const PRODUCTS = ['Potassium metabisulfite', 'Sodium metabisulfite', 'Campden tablets'];
  const sProd = so2.add(['Product', { kmeta: PRODUCTS[0], nameta: PRODUCTS[1], campden: PRODUCTS[2] }[so.input.form], '', `Campden tablets assume ${CAMPDEN_KMETA_G} g K-meta each`], { input: [1] });
  so2.ws.getCell(`B${sProd}`).dataValidation = listValidation(PRODUCTS, 'Sulfite product');
  so2.section('Results');
  so2.header(['Result', 'Value', 'Unit', 'How it is calculated']);
  const B = (n: number) => `B${n}`;
  const pkaRow = so2.add(['SO₂ pKa at this alcohol (20 °C)', f(OIV_PKA_FORMULA(B(sAbv)), so.pKa), '', 'OIV table, interpolated: 1.723 at 0 % → 2.114 at 20 %'], { fmt: { 1: '0.000' } });
  const fracRow = so2.add(['SO₂ fraction of the product', f(`IF(${B(sProd)}="${PRODUCTS[1]}",${NAMETA_SO2_FRACTION},${KMETA_SO2_FRACTION})`, (so.input.form === 'nameta' ? NAMETA_SO2_FRACTION : KMETA_SO2_FRACTION)), '', 'K-meta 57.6 % SO₂ · Na-meta 67.4 %'], { fmt: { 1: '0.0%' } });
  const molFracRow = so2.add(['Molecular share of free SO₂', f(`1/(1+10^(${B(sPh)}-${B(pkaRow)}))`, so.molecularFraction), '', 'molecular = free ÷ (1 + 10^(pH − pKa))'], { fmt: { 1: '0.00%' } });
  const needRow = so2.add(['Free SO₂ needed', f(`${B(sMol)}/${B(molFracRow)}`, r2(so.requiredFreePpm)), 'mg/L', 'Target molecular ÷ molecular share'], { fmt: { 1: '0.0' } });
  const addRow = so2.add(['SO₂ to add', f(`MAX(0,${B(needRow)}-${B(sFree)})/(1-${B(sBind)})`, r2(so.additionPpm)), 'mg/L', '(needed − current free) ÷ (1 − binding)'], { fmt: { 1: '0.0' } });
  const massRow = so2.add(['SO₂ mass', f(`${B(addRow)}*${B(sVol)}/1000`, r3(so.so2Grams)), 'g', ''], { fmt: { 1: '0.000' } });
  so2.add(['Amount of product to add', f(`${B(massRow)}/${B(fracRow)}`, r2(so.productGrams)), 'g', 'Dissolve in a little mead, stir in gently'], { fmt: { 1: '0.00' }, bold: true });
  so2.add(['…or as Campden tablets', f(`${B(massRow)}/${KMETA_SO2_FRACTION}/${CAMPDEN_KMETA_G}`, so.campdenTablets), 'tablets', `${CAMPDEN_KMETA_G} g K-meta per tablet. Check your brand.`], { fmt: { 1: '0.0' } });
  so2.add(['…or as 10 % K-meta stock solution', f(`${B(massRow)}/(0.1*${KMETA_SO2_FRACTION})`, so.stockSolutionMl), 'mL', '10 g K-meta dissolved to 100 mL'], { fmt: { 1: '0.0' } });
  const freeAfter = so2.add(['Free SO₂ after', f(`${B(sFree)}+${B(addRow)}*(1-${B(sBind)})`, r2(so.after.freePpm)), 'mg/L', ''], { fmt: { 1: '0.0' } });
  const totAfter = so2.add(['Total SO₂ after', f(`MAX(${B(sTot)},${B(sFree)})+${B(addRow)}`, r2(so.after.totalPpm)), 'mg/L', `Limits: US ${SO2_LIMIT_US_TOTAL} · EU mead ${SO2_LIMIT_EU_MEAD}`], { fmt: { 1: '0.0' } });
  const molAfter = so2.add(['Molecular SO₂ after', f(`${B(freeAfter)}*${B(molFracRow)}`, r2(so.after.molecularPpm)), 'mg/L', 'Aim 0.5–0.8. Above ~1.5 it can be smelt'], { fmt: { 1: '0.00' } });
  const limitTxt = so.after.totalPpm > SO2_LIMIT_US_TOTAL ? 'Over the US limit' : so.after.totalPpm > SO2_LIMIT_EU_MEAD ? 'Over the EU mead limit' : 'Within limits';
  const limRow = so2.add(['Legal check', f(`IF(${B(totAfter)}>${SO2_LIMIT_US_TOTAL},"Over the US limit",IF(${B(totAfter)}>${SO2_LIMIT_EU_MEAD},"Over the EU mead limit","Within limits"))`, limitTxt), '', '"Contains sulfites" must appear on US labels at 10 mg/L total or more'], { bold: true });
  so2.ws.addConditionalFormatting({ ref: `B${limRow}`, rules: [
    { type: 'containsText', operator: 'containsText', text: 'Over', priority: 1, style: { fill: fill('FFFCA5A5') } },
    { type: 'containsText', operator: 'containsText', text: 'Within', priority: 2, style: { fill: fill(C.good) } },
  ] });
  so2.ws.addConditionalFormatting({ ref: `B${molAfter}`, rules: [{ type: 'cellIs', operator: 'greaterThan', formulae: ['1.5'], priority: 1, style: { fill: fill('FFFDBA74') } }] });
  const sorbOn = !!so.sorbate;
  so2.section('Potassium sorbate (only when back-sweetening)');
  so2.header(['Item', 'Value', 'Unit', 'Notes']);
  const sorbRow = so2.add(['Back-sweetening?', sorbOn ? 'Yes' : 'No', '', 'Sorbate stops renewed fermentation. Add it with SO₂, never alone.'], { input: [1] });
  so2.ws.getCell(`B${sorbRow}`).dataValidation = listValidation(['Yes', 'No'], 'Will you back-sweeten?');
  so2.add(['Potassium sorbate to add', f(`IF(${B(sorbRow)}="Yes",0.2*${B(sVol)},0)`, sorbOn ? r2(0.2 * so.input.volumeL) : 0), 'g', '0.2 g/L ≈ 149 mg/L sorbic acid (US maximum 300 mg/L)'], { fmt: { 1: '0.00' } });
  so2.section('Free SO₂ needed by pH', 'For the target molecular SO₂ and alcohol above. Shows how much lowering the pH saves.');
  so2.header(['pH', 'Free SO₂ needed', 'Unit', '']);
  for (const ph of [3.0, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.0]) {
    const n = so2.row;
    so2.add([ph, f(`${B(sMol)}*(1+10^(A${n}-${B(pkaRow)}))`, r2(so.input.targetMolecularPpm * (1 + 10 ** (ph - so.pKa)))), 'mg/L', ph === Math.round(a.ph.finishedPh * 10) / 10 ? '≈ this mead' : ''], { fmt: { 0: '0.0', 1: '0' } });
  }
  so2.section('Notes');
  for (const w of so.warnings) so2.note(`${w.severity === 'info' ? 'Note' : w.severity === 'warning' ? 'Warning' : 'Problem'}: ${w.text}`);
  so2.freeze(3);

  // ── Advisor ────────────────────────────────────────────────────────────────
  adv.title("Mead Maker's Brain: advice", sub);
  const SEV: Record<string, string> = { error: 'Must fix', warning: 'Review', tip: 'Suggestion', info: 'Note' };
  const AREA: Record<string, string> = { fruit: 'Fruit', acid: 'Acidity', tannin: 'Tannin', body: 'Body', gravity: 'Gravity', spice: 'Spice', honey: 'Honey', process: 'Process' };
  adv.section('Recipe check & suggestions', '"Must fix" and "Review" are what the app\'s Check recipe button shows; suggestions appear in the Brain panel.');
  adv.header(['Priority', 'Area', 'Title', 'Detail', 'Suggestion', 'Sources']);
  const firstAdv = adv.row;
  for (const x of a.advisories) {
    const n = adv.add([SEV[x.severity], AREA[x.category] ?? x.category, x.title, x.detail, x.suggestion ?? '', x.source.map((id) => SOURCES[id]?.short ?? id).join(', ')]);
    adv.ws.getCell(`A${n}`).fill = fill(C[x.severity]);
  }
  if (a.advisories.length === 0) adv.add(['—', '', 'Nothing to flag', '', '', '']);
  void firstAdv;
  adv.section('Pairing ideas');
  adv.header(['With', '', 'Try adding', 'Why', 'Starting dose', '']);
  for (const p of a.suggestions) adv.add([p.forName, '', p.partnerName, p.note, p.startDoseGPerL != null ? `${p.startDoseGPerL} g/L` : 'to taste', '']);
  if (a.suggestions.length === 0) adv.add(['—', '', 'No pairing ideas for this recipe', '', '', '']);
  adv.freeze(3);

  // ── Log ────────────────────────────────────────────────────────────────────
  if (log) {
    const lg = r.log;
    log.title('Batch log', `${sub}${lg.pitchedAt ? ` · pitched ${new Date(lg.pitchedAt).toLocaleString()}` : ''}`);
    log.section('Gravity readings', 'Add rows as you take readings: ABV and sugar used update from the first reading.');
    log.header(['Date & time', 'SG', 'Day', 'ABV so far (%)', 'Sugar used (%)', 'Note']);
    const sorted = [...lg.readings].sort((x, y) => Date.parse(x.at) - Date.parse(y.at));
    const t0 = lg.pitchedAt ? Date.parse(lg.pitchedAt) : sorted[0] ? Date.parse(sorted[0].at) : 0;
    const first = log.row;
    const og0 = sorted[0]?.sg ?? og;
    sorted.forEach((rd) => {
      const n = log.row;
      log.add([new Date(rd.at), rd.sg, Number(((Date.parse(rd.at) - t0) / 86_400_000).toFixed(1)),
        f(`IF(B$${first}>B${n},(76.08*(B$${first}-B${n})/(1.775-B$${first}))*(B${n}/0.794),0)`, og0 > rd.sg ? r2(abvFn(og0, rd.sg)) : 0),
        f(`IF(B$${first}>1,(B$${first}-B${n})/(B$${first}-1),0)`, og0 > 1 ? (og0 - rd.sg) / (og0 - 1) : 0), rd.note ?? ''],
      { fmt: { 0: 'yyyy-mm-dd hh:mm', 1: '0.000', 2: '0.0', 3: '0.00', 4: '0%' }, input: [0, 1] });
    });
    log.section('Nutrient additions');
    log.header(['Dose', 'When', '', '', 'Done?', 'Amount'], {}, [1, 3]);
    a.schedule.doses.forEach((d, i) => {
      const n = log.add([`#${d.n}`, d.when, '', '', lg.dosesDone?.[i] ? 'Yes' : 'No', [d.fermaidO && `${d.fermaidO.toFixed(1)} g Fermaid O`, d.fermaidK && `${d.fermaidK.toFixed(1)} g Fermaid K`, d.dap && `${d.dap.toFixed(1)} g DAP`].filter(Boolean).join(' + ') || 'none'], { input: [4], span: [1, 3] });
      log.ws.getCell(`E${n}`).dataValidation = listValidation(['Yes', 'No'], 'Has this dose been added?');
    });
    log.freeze(3);
  }

  // ── Sources ────────────────────────────────────────────────────────────────
  src.title('Sources, licences & how they are used', 'Formulas and facts are re-implemented and credited; no third-party text, tables or code are reproduced.');
  src.header(['Source', 'Citation', 'Licence status', 'How it is used', 'Link']);
  for (const x of Object.values(SOURCES)) {
    const n = src.add([x.short, x.citation, LICENSE_LABEL[x.license], x.usage, x.url ? { text: x.url, hyperlink: x.url } : '']);
    if (x.url) src.ws.getCell(`E${n}`).font = { color: { argb: 'FF1D4ED8' }, underline: true };
  }
  src.freeze(3);

  // ── Read me ────────────────────────────────────────────────────────────────
  readme.title(`Mead Lab: ${r.name}`, `${version} · exported ${date}`);
  readme.section('Sheets');
  readme.header(['Sheet', 'What it contains']);
  const SHEETS: [string, string][] = [
    ['Summary', 'Recipe overview, gravity, ABV, sweetness, acidity, volumes, bottles and taste profile. Enter your measured OG/FG here.'],
    ['Ingredients', 'Honey, sugar, fruit, botanicals and additions with sugar, dose per litre and live dose bands.'],
    ['Nutrients', 'YAN target and the staggered nutrient schedule. Change demand, protocol or volume and it recalculates.'],
    ['Acidity', 'Predicted pH and acidity, what moves the pH, and fruit dose → pH.'],
    ['Sulfite', 'Live SO₂ calculator: pH, ABV and target in, grams of K-meta or Campden tablets out, with legal checks.'],
    ['Advisor', 'Everything the app\'s Check recipe and Mead Maker\'s Brain would tell you, plus pairing ideas.'],
    ...(log ? [['Log', 'Your gravity readings with ABV so far, and the nutrient checklist.'] as [string, string]] : []),
    ['Sources', 'Every source, its licence status and how it is used.'],
  ];
  for (const [name, what] of SHEETS) {
    const n = readme.add([{ text: name, hyperlink: `#'${name}'!A1` }, what]);
    readme.ws.getCell(`A${n}`).font = { color: { argb: 'FF1D4ED8' }, underline: true, bold: true };
  }
  readme.section('How to use it');
  readme.header(['Item', 'Meaning']);
  const keyRow = readme.add(['Yellow cell', 'An input. Change it and the sheet recalculates.']);
  readme.ws.getCell(`A${keyRow}`).fill = fill(C.input);
  readme.add(['Cell with a red triangle', 'Hover or tap it for an explanation.']);
  readme.add(['"from the app"', 'Calculated by Mead Lab\'s heavier models (mass balance, pH). Fixed in this file, so re-export after changing the recipe.']);
  readme.add(['Units', 'Metric with US conversions alongside. SG = specific gravity · mg/L = ppm · TA as g/L tartaric acid.']);
  readme.add(['Google Sheets', 'Upload this file to Google Drive and open it with Google Sheets. Formulas, dropdowns and colours carry over.']);
  readme.add(['Caution', 'Guidance, not gospel: check with a hydrometer, a pH meter and bench trials. Never exceed legal additive limits.']);
  return wb;
}

/** Tab-separated summary that pastes cleanly into Google Sheets or Excel (values only, labelled). */
export function toTsv(a: Analysis, versionLabel?: string): string {
  const unitRow = (label: string, v: string | number, unit: string) => [label, v, unit];
  const L: (string | number)[][] = [
    ['Mead Lab', a.recipe.name, versionLabel ?? ''],
    [],
    ['Measure', 'Value', 'Unit'],
    unitRow('Original gravity (predicted)', a.og.toFixed(3), 'SG'),
    unitRow('Final gravity (predicted)', a.fg.fg.toFixed(3), 'SG'),
    unitRow('ABV (Alternative equation)', a.abv.toFixed(2), '% v/v'),
    unitRow('Sweetness', a.sweetness, ''),
    unitRow('Must volume', a.primary.volumeL.toFixed(2), 'L'),
    unitRow('Water to add', a.primary.waterL.toFixed(2), 'L'),
    unitRow('Finished pH (predicted)', a.ph.finishedPh.toFixed(2), 'pH'),
    [],
    ['Ingredient', 'Stage', 'Amount', 'Unit', 'OG points'],
    ...a.recipe.honeys.map((h) => [honeyById(h.honeyId).name + ' honey', 'Primary', h.massKg, 'kg', (a.contributions.find((c) => c.key === h.uid)?.deltaPoints ?? 0).toFixed(1)]),
    ...a.recipe.sugars.map((g) => [sugarById(g.sugarId).name, 'Primary', g.massKg, 'kg', (a.contributions.find((c) => c.key === g.uid)?.deltaPoints ?? 0).toFixed(1)]),
    ...a.recipe.fruits.map((fr) => [fruitById(fr.fruitId).name, fr.stage === 'primary' ? 'Primary' : 'Secondary', fr.massKg, 'kg', fr.stage === 'primary' ? (a.contributions.find((c) => c.key === fr.uid)?.deltaPoints ?? 0).toFixed(1) : 'not in OG']),
    ...a.recipe.spices.map((sp) => [spiceById(sp.spiceId).name, 'Secondary', sp.grams, 'g', '']),
    [],
    ['Nutrient dose', 'When', 'Fermaid O (g)', 'Fermaid K (g)', 'DAP (g)'],
    ...a.schedule.doses.map((d) => [d.n, d.when, d.fermaidO.toFixed(2), d.fermaidK.toFixed(2), d.dap.toFixed(2)]),
    [],
    ['Sulfite', 'Value', 'Unit'],
    unitRow('pH used', a.sulfite.input.pH.toFixed(2), 'pH'),
    unitRow('Free SO2 needed', a.sulfite.requiredFreePpm.toFixed(1), 'mg/L'),
    unitRow('SO2 to add', a.sulfite.additionPpm.toFixed(1), 'mg/L'),
    unitRow(SULFITE_FORMS[a.sulfite.input.form].label, a.sulfite.productGrams.toFixed(2), 'g'),
    unitRow('Total SO2 after', a.sulfite.after.totalPpm.toFixed(1), 'mg/L'),
  ];
  return L.map((row) => row.join('\t')).join('\n');
}

export function fileName(a: Analysis, versionLabel?: string) {
  const base = `${a.recipe.name}${versionLabel?.match(/v\d+/) ? ` ${versionLabel.match(/v\d+/)![0]}` : ''}`;
  return `${base.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'mead'}.xlsx`;
}
