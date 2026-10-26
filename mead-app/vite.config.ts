/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // SINGLE=1 → inline the lazy export chunk too, for the single-file artifact build
  build: process.env.SINGLE ? { rollupOptions: { output: { inlineDynamicImports: true } } } : {},
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
