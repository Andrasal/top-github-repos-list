/** Single-file artifact build: load ExcelJS from cdnjs on first export instead of inlining ~1 MB. */
const URL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
let pending: Promise<void> | null = null;

export function ensureExcel(): Promise<void> {
  if ((window as unknown as { ExcelJS?: unknown }).ExcelJS) return Promise.resolve();
  pending ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      pending = null;
      s.remove();
      reject(new Error('Could not load the spreadsheet library. Check your connection and try again.'));
    };
    document.head.appendChild(s);
  });
  return pending;
}
