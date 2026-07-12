/**
 * check-paranoid.ts
 * Static-only check: detects `paranoid: true` in Sequelize models that declare
 * no `deletedAt` / `deleted_at` in their attribute interface.
 * Runs without a DB connection — safe for CI.
 *
 * Uso: cd backend && pnpm run check:paranoid
 */

import * as fs from 'fs';
import * as path from 'path';

const modelsDir = path.resolve(__dirname, '../models');
const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.ts'));

let errors = 0;

for (const file of files) {
  const src = fs.readFileSync(path.join(modelsDir, file), 'utf-8');

  const hasParanoidTrue = /paranoid:\s*true/.test(src);
  if (!hasParanoidTrue) continue;

  // Accept only if the interface declares deletedAt or deleted_at
  const declaresDeletedAt = /deleted(_at|[Aa]t)[\?]?\s*:/.test(src);

  if (!declaresDeletedAt) {
    console.error(`❌  ${file}: paranoid: true but no deletedAt in interface`);
    errors++;
  } else {
    console.log(`✅  ${file}: paranoid: true + deletedAt declared`);
  }
}

if (errors === 0) {
  console.log('✅ All paranoid models declare deletedAt.');
} else {
  console.error(`\n❌ ${errors} model(s) with paranoid: true but missing deletedAt declaration.`);
  process.exit(1);
}
