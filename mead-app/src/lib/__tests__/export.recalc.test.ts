/**
 * SPEC §14.2 — the export's formulas are recalculated by a real spreadsheet engine (LibreOffice,
 * headless) from ZEROED cached results, then compared cell-by-cell with the app. Also edits inputs
 * inside the sheet and checks the recalculated outputs against the app's own answer for that change.
 * Skipped where LibreOffice is not installed.
 */
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { execSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildWorkbook } from '../export';
import { analyzeRecipe, DEFAULT_RECIPE, Recipe } from '../recipe';
import { PRESETS } from '../presets';
import { abv } from '../abv';
import { sulfitePlan } from '../sulfite';

const hasSoffice = (() => { try { execSync('command -v soffice', { stdio: 'ignore' }); return true; } catch { return false; } })();

function recalc(dir: string, file: string): Promise<ExcelJS.Workbook> {
  const profile = join(dir, 'profile');
  mkdirSync(join(profile, 'user'), { recursive: true });
  writeFileSync(join(profile, 'user', 'registrymodifications.xcu'), '<?xml version="1.0" encoding="UTF-8"?><oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item></oor:items>');
  execSync(`soffice -env:UserInstallation=file://${profile} --headless --convert-to xlsx --outdir ${join(dir, 'out')} ${join(dir, file)}`, { stdio: 'ignore', timeout: 120_000 });
  const wb = new ExcelJS.Workbook();
  return wb.xlsx.readFile(join(dir, 'out', file)).then(() => wb);
}
const poison = (wb: ExcelJS.Workbook) => wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((c) => { const v = c.value as { formula?: string }; if (v && typeof v === 'object' && v.formula) c.value = { formula: v.formula, result: 0 } as ExcelJS.CellValue; })));
const num = (v: unknown) => (v && typeof v === 'object' && 'formula' in (v as object) ? ((v as { result?: unknown }).result ?? 0) : v);
const rowOf = (ws: ExcelJS.Worksheet, label: string, col = 1) => { let n = 0; ws.eachRow((r) => { if (!n && String(r.getCell(col).value) === label) n = r.number; }); if (!n) throw new Error(`no row ${label}`); return n; };

describe.skipIf(!hasSoffice)('export recalculated by LibreOffice (SPEC §14.2)', () => {
  it('every formula cell reproduces the app across varied recipes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'meadxl-'));
    const cases: Record<string, Recipe> = {
      kdap: { ...DEFAULT_RECIPE, protocol: 'kDap', sulfite: { ...DEFAULT_RECIPE.sulfite, form: 'nameta', currentFreePpm: 10, currentTotalPpm: 40 } },
      logged: { ...DEFAULT_RECIPE, targetFg: 1.012, log: { pitchedAt: '2026-10-01T18:00:00Z', readings: [{ uid: '1', at: '2026-10-01T18:00:00Z', sg: 1.099 }, { uid: '2', at: '2026-10-05T18:00:00Z', sg: 1.04 }], dosesDone: [true, true, true, false] } },
      pear: { ...DEFAULT_RECIPE, ...PRESETS.find((p) => p.id === 'elderflower-pear')!.recipe, protocol: 'oK' },
    };
    let cells = 0;
    const bad: string[] = [];
    for (const [name, r] of Object.entries(cases)) {
      const cached = buildWorkbook(analyzeRecipe(r));
      const copy = buildWorkbook(analyzeRecipe(r));
      poison(copy);
      writeFileSync(join(dir, `${name}.xlsx`), Buffer.from(await copy.xlsx.writeBuffer()));
      const back = await recalc(dir, `${name}.xlsx`);
      cached.eachSheet((ws) => ws.eachRow((row) => row.eachCell((c) => {
        const v = c.value as { formula?: string; result?: unknown };
        if (!v || typeof v !== 'object' || !v.formula) return;
        cells++;
        const got = num(back.getWorksheet(ws.name)!.getCell(c.address).value);
        const want = v.result ?? 0;
        const ok = typeof want === 'number' ? typeof got === 'number' && Math.abs(got - want) <= Math.max(1e-6, Math.abs(want) * 1e-6) : String(got) === String(want);
        if (!ok) bad.push(`${name} ${ws.name}!${c.address}: ${want} vs ${got}`);
      })));
    }
    expect(bad).toEqual([]);
    expect(cells).toBeGreaterThan(200);
  }, 300_000);

  it('editing inputs in the sheet gives the app\'s answer for the same change', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'meadxl-'));
    const a = analyzeRecipe(DEFAULT_RECIPE);
    const wb = buildWorkbook(a);
    const sum = wb.getWorksheet('Summary')!, nut = wb.getWorksheet('Nutrients')!, so = wb.getWorksheet('Sulfite')!, ing = wb.getWorksheet('Ingredients')!;
    sum.getCell(`B${rowOf(sum, 'Your measured FG')}`).value = 1.0;
    nut.getCell(`C${rowOf(nut, 'Protocol', 2)}`).value = 'Fermaid K + DAP';
    nut.getCell(`C${rowOf(nut, 'Yeast nitrogen demand', 2)}`).value = 'high';
    so.getCell(`B${rowOf(so, 'Product')}`).value = 'Sodium metabisulfite';
    so.getCell(`B${rowOf(so, 'pH')}`).value = 3.4;
    ing.getCell(`C${rowOf(ing, 'Vanilla bean', 2)}`).value = 30;
    poison(wb);
    writeFileSync(join(dir, 'edited.xlsx'), Buffer.from(await wb.xlsx.writeBuffer()));
    const back = await recalc(dir, 'edited.xlsx');
    const S = back.getWorksheet('Summary')!, N = back.getWorksheet('Nutrients')!, O = back.getWorksheet('Sulfite')!, I = back.getWorksheet('Ingredients')!;
    const expAbv = abv(a.effectiveOg, 1.0);
    expect(num(S.getCell(`B${rowOf(S, 'ABV (Alternative equation)')}`).value)).toBeCloseTo(expAbv, 6);
    expect(num(S.getCell(`B${rowOf(S, 'Sweetness')}`).value)).toBe('Dry');
    const b = analyzeRecipe({ ...DEFAULT_RECIPE, protocol: 'kDap', nDemandOverride: 'high' });
    const tot = rowOf(N, 'Total', 2);
    expect(num(N.getCell(`D${tot}`).value)).toBeCloseTo(b.schedule.totals.fermaidK, 5);
    expect(num(N.getCell(`E${tot}`).value)).toBeCloseTo(b.schedule.totals.dap, 5);
    const p = sulfitePlan({ ...a.sulfite.input, pH: 3.4, form: 'nameta', abv: expAbv });
    expect(num(O.getCell(`B${rowOf(O, 'Amount of product to add')}`).value)).toBeCloseTo(p.productGrams, 6);
    expect(num(I.getCell(`J${rowOf(I, 'Vanilla bean', 2)}`).value)).toBe('far too much');
  }, 300_000);
});
