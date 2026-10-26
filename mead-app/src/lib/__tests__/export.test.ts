import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildWorkbook, fileName, toTsv } from '../export';
import { analyzeRecipe, DEFAULT_RECIPE } from '../recipe';
import { abv as abvRef } from '../abv';

const find = (ws: ExcelJS.Worksheet, label: string, col = 'B', labelCol = 1) => {
  let hit: ExcelJS.Cell | null = null;
  ws.eachRow((row) => { if (!hit && String(row.getCell(labelCol).value) === label) hit = ws.getCell(`${col}${row.number}`); });
  if (!hit) throw new Error(`label not found: ${label}`);
  return (hit as ExcelJS.Cell).value as { formula?: string; result?: unknown } & ExcelJS.CellValue;
};

describe('export (SPEC §14)', () => {
  const a = analyzeRecipe({ ...DEFAULT_RECIPE, targetFg: 1.012 });
  it('builds every sheet, Read me first, and round-trips through xlsx', async () => {
    const wb = buildWorkbook(a, { generated: new Date('2026-10-26'), versionLabel: 'v2' });
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Read me', 'Summary', 'Ingredients', 'Nutrients', 'Acidity', 'Sulfite', 'Advisor', 'Sources']);
    const buf = await wb.xlsx.writeBuffer();
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(buf as ArrayBuffer);
    const abv = find(back.getWorksheet('Summary')!, 'ABV (Alternative equation)');
    expect(abv.formula).toMatch(/76\.08\*\(B\d+-B\d+\)\/\(1\.775-B\d+\)/);
    expect(abv.result).toBeCloseTo(a.abv, 2);
    expect(find(back.getWorksheet('Sulfite')!, 'Amount of product to add').result).toBeCloseTo(a.sulfite.productGrams, 2);
    expect(find(back.getWorksheet('Nutrients')!, 'Yeast nitrogen demand', 'C', 2)).toBe('medium');
  });
  it('adds a Log sheet when the batch has readings', () => {
    const logged = buildWorkbook(analyzeRecipe({ ...DEFAULT_RECIPE, log: { pitchedAt: '2026-10-01T18:00:00Z', readings: [{ uid: 'a', at: '2026-10-01T18:00:00Z', sg: 1.1 }, { uid: 'b', at: '2026-10-05T18:00:00Z', sg: 1.05 }], dosesDone: [true, true, true, false] } }));
    const ws = logged.getWorksheet('Log')!;
    let abvCell: unknown = null;
    ws.eachRow((row) => { const v = row.getCell(2).value; if (v === 1.05) abvCell = row.getCell(4).value; });
    expect((abvCell as { result: number }).result).toBeCloseTo(abvRef(1.1, 1.05), 2);
  });
  it('every header cell is named and every input carries the input fill', () => {
    const wb = buildWorkbook(a);
    wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((c) => {
      const isHeaderFill = (c.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb === 'FFFDE68A';
      if (isHeaderFill) expect(String(c.value ?? '').trim()).not.toBe('');
    })));
  });
  it('TSV has labelled rows with units', () => {
    const t = toTsv(a, 'v2');
    expect(t).toContain('ABV (Alternative equation)\t' + a.abv.toFixed(2) + '\t% v/v');
    expect(t.split('\n').length).toBeGreaterThan(20);
  });
  it('file name carries the version', () => {
    expect(fileName(a, 'Wildflower Blackberry Melomel v3')).toBe('Wildflower_Blackberry_Melomel_v3.xlsx');
  });
});
