import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
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

for (const file of required) {
  await stat(join(root, file));
}

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
await import(join(root, 'src/index.js'));
console.log(`OK: ${required.length} required files, ${jsFiles.length} JS files checked.`);
