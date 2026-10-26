import { useRef, useState } from 'react';
import type { Analysis } from '../lib/recipe';
import { copyText, saveFile } from './download';

export function ExportPanel({ a }: { a: Analysis }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  async function excel() {
    setBusy(true);
    setStatus('Building workbook…');
    try {
      const { buildWorkbook, fileName } = await import('../lib/export');
      const buf = await buildWorkbook(a).xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const res = await saveFile(fileName(a), blob);
      setStatus(res === 'saved' ? `Saved ${fileName(a)}` : res === 'declined' ? 'Save cancelled.' : 'This view cannot save files. Use “Copy for Google Sheets” instead.');
    } catch (e) {
      setStatus(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function sheets() {
    const { toTsv } = await import('../lib/export');
    const ok = await copyText(toTsv(a), ta.current);
    setStatus(ok ? 'Copied. In Google Sheets, click cell A1 and paste.' : 'Copy was blocked. Select the text below and copy it manually.');
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-2">
        <button className="btn-primary w-full justify-center py-2" onClick={excel} disabled={busy}>
          Download Excel workbook (.xlsx)
        </button>
        <p className="text-stone-600 dark:text-stone-300">
          Six sheets: Summary, Ingredients, Nutrients, Sulfite, Advisor and Sources. ABV, sulfite, YAN and totals are <b>live formulas</b>, and the yellow cells are
          inputs. Change your measured FG or pH and the sheet recalculates.
        </p>
        <p className="text-stone-600 dark:text-stone-300">
          <b>Google Sheets:</b> upload the .xlsx to Drive and open it with Google Sheets. The formulas carry over.
        </p>
      </div>
      <div className="space-y-2 border-t border-stone-200 pt-4 dark:border-stone-800">
        <button className="btn-ghost w-full justify-center border border-stone-300 py-2 dark:border-stone-700" onClick={sheets}>
          Copy for Google Sheets (paste)
        </button>
        <p className="text-stone-600 dark:text-stone-300">A quick tab-separated summary (values only) that pastes straight into Sheets or Excel.</p>
        <textarea ref={ta} hidden readOnly rows={6} className="w-full rounded-md border border-stone-300 p-2 font-mono text-xs dark:border-stone-700 dark:bg-stone-900" aria-label="Export text" />
      </div>
      {status && <p role="status" className="rounded-md bg-stone-100 p-2 dark:bg-stone-800">{status}</p>}
    </div>
  );
}
