import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Part 1: src/data/commands.ts is gone — the compiled aggregate in
 * backend/data/commands.json is the pipeline output the SPA reads via the API.
 * Same contract as before, executed against that file: every `related`
 * reference must resolve to a real slug, unique slugs, and every referenced
 * category/domain must exist. */

type CommandEntry = {
  slug: string;
  name: string;
  section: string;
  category?: string;
  domain?: string;
  related?: string[];
};

const here = dirname(fileURLToPath(import.meta.url));
const datasetPath = join(here, '..', 'backend', 'data', 'commands.json');
const dataset = JSON.parse(readFileSync(datasetPath, 'utf-8')) as {
  categories: CategoryRef[];
  domains: DomainRef[];
  commands: CommandEntry[];
};
type CategoryRef = { id: string; name: string; section: string; description: string };
type DomainRef = { id: string; name: string; description: string; tools?: string[] };

const errors: string[] = [];
const slugs = new Set(dataset.commands.map((entry) => entry.slug));

if (slugs.size !== dataset.commands.length) {
  errors.push(`duplicate slugs detected (${slugs.size} unique of ${dataset.commands.length})`);
}

const categoryIds = new Set(dataset.categories.map((c) => c.id));
const domainIds = new Set(dataset.domains.map((d) => d.id));

for (const entry of dataset.commands) {
  if (entry.related) {
    for (const ref of entry.related) {
      if (!slugs.has(ref)) {
        errors.push(`${entry.slug}: dangling related reference '${ref}'`);
      }
    }
  }
  // Linux entries carry a category id; CTF entries carry the domain id in
  // `category` (their `domain` field stays null in the aggregate).
  if (entry.section === 'ctf') {
    if (entry.domain && !domainIds.has(entry.domain)) {
      errors.push(`${entry.slug}: unknown domain '${entry.domain}'`);
    }
    if (entry.category && !domainIds.has(entry.category)) {
      errors.push(`${entry.slug}: unknown domain '${entry.category}'`);
    }
  } else if (entry.category && !categoryIds.has(entry.category)) {
    errors.push(`${entry.slug}: unknown category '${entry.category}'`);
  }
}

if (errors.length === 0) {
  console.log('SUCCESS: All command links and references in the compiled dataset are valid!');
  process.exit(0);
} else {
  console.error('FAILED: Link validation errors found:');
  errors.forEach((err) => console.error(` - ${err}`));
  process.exit(1);
}
