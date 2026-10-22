// One-off utility: split backend/data/commands.json into backend/data/commands/<slug>.json
// (the per-entry source of truth for the new backend-first dataset pipeline).
// Runs once; after the split, build_commands.mjs owns the aggregated outputs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const aggPath = path.join(root, 'backend', 'data', 'commands.json');
const outDir = path.join(root, 'backend', 'data', 'commands');

const aggregate = JSON.parse(fs.readFileSync(aggPath, 'utf8'));
if (!Array.isArray(aggregate.commands) || aggregate.commands.length === 0) {
  throw new Error('commands.json has no commands');
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const seen = new Set();
for (const command of aggregate.commands) {
  if (seen.has(command.slug)) throw new Error(`duplicate slug in source: ${command.slug}`);
  seen.add(command.slug);
  const body = JSON.stringify(command, null, 2) + '\n';
  fs.writeFileSync(path.join(outDir, `${command.slug}.json`), body, 'utf8');
}

const order = aggregate.commands.map((command) => command.slug);
fs.writeFileSync(
  path.join(root, 'backend', 'data', 'commands-order.json'),
  JSON.stringify({ order }, null, 2) + '\n',
  'utf8',
);

fs.writeFileSync(path.join(root, 'backend', 'data', 'categories.json'), JSON.stringify(aggregate.categories, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(root, 'backend', 'data', 'domains.json'), JSON.stringify(aggregate.domains, null, 2) + '\n', 'utf8');

console.log(`split ${aggregate.commands.length} entries into backend/data/commands/`);
console.log(`wrote backend/data/commands-order.json (${order.length} slugs, aggregate order preserved)`);
console.log(`wrote backend/data/categories.json (${aggregate.categories.length}) and domains.json (${aggregate.domains.length})`);
