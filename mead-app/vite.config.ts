/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  base: './',
  // SINGLE=1 → one self-contained file for the claude.ai artifact: inline lazy chunks,
  // and fetch ExcelJS from cdnjs on first export instead of inlining it (~1 MB smaller).
  build: process.env.SINGLE ? { rollupOptions: { output: { inlineDynamicImports: true } } } : {},
  resolve: process.env.SINGLE
    ? {
        alias: [
          { find: /^exceljs$/, replacement: fileURLToPath(new URL('./src/lib/exceljs-global.ts', import.meta.url)) },
          { find: /^\.\/excel-loader$/, replacement: fileURLToPath(new URL('./src/lib/excel-loader.cdn.ts', import.meta.url)) },
        ],
      }
    : {},
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
