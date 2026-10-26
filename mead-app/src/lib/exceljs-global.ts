/** Single-file build stand-in for `import ExcelJS from 'exceljs'`: forwards to the CDN global (see excel-loader.cdn.ts). */
import type ExcelJSType from 'exceljs';
const ExcelJS = new Proxy({} as typeof ExcelJSType, {
  get: (_t, key) => (window as unknown as { ExcelJS: Record<string | symbol, unknown> }).ExcelJS[key],
});
export default ExcelJS;
