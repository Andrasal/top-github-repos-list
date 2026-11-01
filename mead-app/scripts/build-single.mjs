// Build a single self-contained HTML page (for the claude.ai Artifact): node scripts/build-single.mjs [out.html]
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, SINGLE: '1' } });
const dir = 'dist/assets';
const files = readdirSync(dir);
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(`${dir}/${f}`, 'utf8')).join('\n');
const js = files.filter((f) => f.endsWith('.js'));
if (js.length !== 1) throw new Error(`expected one JS bundle, got ${js.join(', ')}`);
const code = readFileSync(`${dir}/${js[0]}`, 'utf8').replace(/<\/script/gi, '<\\/script')
  // bundled libs carry literal U+FFFD inside string literals; the \uFFFD escape is identical at runtime
  .replace(/\uFFFD/g, '\\uFFFD');
const out = process.argv[2] ?? 'dist/mead-lab.html';
const head = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="UTF-8" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '<title>Mead Lab</title>',
  '<link rel="preconnect" href="https://fonts.googleapis.com" />',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" />',
  `<style>${css}</style>`,
  '</head>',
].join('\n');
writeFileSync(out, `${head}\n<body>\n<div id="root"></div>\n<script type="module">${code}</script>\n</body>\n</html>\n`);
console.log(`wrote ${out}`);
