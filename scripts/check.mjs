import { readdir, stat, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const required = [
  'package.json',
  'wrangler.jsonc',
  'src/index.js',
  'src/admin/ui.js',
  'src/miniapp/ui.js',
  'src/routes/api.js',
  'src/storage/kv.js',
  'docs/SETUP.md',
  'docs/API_KEYS.md'
];

for (const file of required) await stat(join(root, file));

const jsFiles = [];
async function walk(dir) {
  for (const item of await readdir(dir)) {
    const p = join(dir, item);
    const s = await stat(p);
    if (s.isDirectory()) await walk(p);
    else if (p.endsWith('.js') || p.endsWith('.mjs')) jsFiles.push(p);
  }
}
await walk(join(root, 'src'));
await walk(join(root, 'scripts'));

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}

const { adminHtml } = await import(join(root, 'src/admin/ui.js'));
const { miniAppHtml } = await import(join(root, 'src/miniapp/ui.js'));
for (const [name, html] of [['admin', adminHtml()], ['miniapp', miniAppHtml()]]) {
  const scripts = [...html.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
  for (let i = 0; i < scripts.length; i++) {
    const tmp = join(root, `.tmp-${name}-script-${i}.js`);
    await writeFile(tmp, scripts[i]);
    const result = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
    if (result.status !== 0) {
      console.error(`Embedded ${name} script ${i} failed syntax check:`);
      console.error(result.stderr || result.stdout);
      process.exit(result.status || 1);
    }
  }
}

await import(join(root, 'src/index.js'));
console.log(`OK: ${required.length} required files, ${jsFiles.length} JS files, embedded UI scripts checked.`);
