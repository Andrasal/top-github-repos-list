import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildWorkbook, toTsv } from '../export';
import { analyzeRecipe, DEFAULT_RECIPE } from '../recipe';
import { abv as abvRef } from '../abv';

describe('export (SPEC §14)', () => {
  const a = analyzeRecipe({ ...DEFAULT_RECIPE, targetFg: 1.012 });
  it('builds a workbook with all sheets and round-trips through xlsx', async () => {
    const wb = buildWorkbook(a, { generated: new Date('2026-10-26') });
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Summary', 'Ingredients', 'Nutrients', 'Sulfite', 'Advisor', 'Sources']);
    const logged = buildWorkbook(analyzeRecipe({ ...DEFAULT_RECIPE, log: { pitchedAt: '2026-10-01T18:00:00Z', readings: [{ uid: 'a', at: '2026-10-01T18:00:00Z', sg: 1.1 }, { uid: 'b', at: '2026-10-05T18:00:00Z', sg: 1.05 }], dosesDone: [true, true, true, false] } }));
    expect(logged.getWorksheet('Log')!.getCell('D6').value).toMatchObject({ result: expect.closeTo(abvRef(1.1, 1.05), 8) });
    const buf = await wb.xlsx.writeBuffer();
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(buf as ArrayBuffer);
    const abv = back.getWorksheet('Summary')!.getCell('B9').value as { formula: string; result: number };
    expect(abv.formula).toBe('(76.08*(B7-B8)/(1.775-B7))*(B8/0.794)');
    expect(abv.result).toBeCloseTo(a.abv, 6);
    const so2 = back.getWorksheet('Sulfite')!.getCell('B19').value as { formula: string; result: number };
    expect(so2.result).toBeCloseTo(a.sulfite.productGrams, 6);
  });
  it('excel ABV formula cells evaluate to the app value', () => {
    // Reproduce the spreadsheet formula with the cached inputs
    const og = a.effectiveOg, fg = a.fg.fg;
    expect((76.08 * (og - fg) / (1.775 - og)) * (fg / 0.794)).toBeCloseTo(a.abv, 10);
  });
  it('sulfite sheet formulas reproduce the plan', () => {
    const s = a.sulfite.input;
    const frac = 1 / (1 + 10 ** (s.pH - 1.81));
    const add = Math.max(0, 0.8 / frac - s.currentFreePpm) / (1 - s.bindingPct / 100);
    expect(add).toBeCloseTo(a.sulfite.additionPpm, 8);
  });
  it('TSV has tabs and key values', () => {
    const t = toTsv(a);
    expect(t).toContain('ABV (Alternative eq.) %\t' + a.abv.toFixed(2));
    expect(t.split('\n').length).toBeGreaterThan(20);
  });
});
