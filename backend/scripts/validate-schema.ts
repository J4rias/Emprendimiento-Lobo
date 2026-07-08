/**
 * validate-schema.ts
 * Compara los modelos Sequelize con las columnas reales de la base de datos.
 * Detecta: columnas declaradas en el modelo que no existen en la tabla,
 * y `paranoid: true` en modelos cuya tabla no tiene `deleted_at`.
 *
 * Uso: cd backend && pnpm run validate:schema
 */

import { Sequelize, QueryTypes } from 'sequelize';
import * as fs from 'fs';
import * as path from 'path';

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const sequelize = new Sequelize(
  process.env.DB_NAME!,
  process.env.DB_USER!,
  process.env.DB_PASSWORD!,
  {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dialect: 'mysql',
    logging: false
  }
);

// ─── Model file → table name + attribute names (via static analysis) ────────

interface ModelMeta {
  file: string;
  tableName: string;
  paranoid: boolean;
  attributes: string[];
}

/**
 * Naive static extractor: reads the TS source and pulls out:
 * - tableName string
 * - paranoid: true/false
 * - top-level attribute keys declared inside the model definition object
 */
function extractModelMeta(filePath: string): ModelMeta | null {
  const src = fs.readFileSync(filePath, 'utf-8');

  // tableName
  const tableMatch = src.match(/tableName:\s*['"`](\w+)['"`]/);
  if (!tableMatch) return null;
  const tableName = tableMatch[1];

  // paranoid
  const paranoid = /paranoid:\s*true/.test(src);

  // Attributes: collect top-level keys in the fields object passed to define().
  // Strategy: find the define() call, extract its first argument block, then
  // parse top-level keys from that block (depth-1 keys only).
  // Fallback to regex if define() pattern not found.
  const NON_ATTR_KEYS = new Set([
    'hooks', 'indexes', 'validate', 'getterMethods', 'setterMethods',
    // Sequelize FK / query options that can appear at 4-space indent in
    // 2-space-indented models or inside static method calls:
    'references', 'where', 'order', 'include', 'limit', 'offset',
    'attributes', 'group', 'having', 'transaction', 'paranoid',
  ]);

  const attributes: string[] = [];

  // Find the define() / init() attributes block by locating all 4-space-indented
  // `key: {` lines that are NOT VIRTUAL fields and NOT non-attribute keys.
  // Additionally skip any key whose block contains `DataTypes.VIRTUAL`.
  const attrMatches = [...src.matchAll(/^( {4})(\w+):\s*\{/gm)];
  for (const m of attrMatches) {
    const key = m[2];
    if (NON_ATTR_KEYS.has(key)) continue;

    // Check if this attribute is a VIRTUAL field (no DB column)
    // by scanning a short window forward for `DataTypes.VIRTUAL`
    const matchEnd = m.index! + m[0].length;
    const snippet = src.slice(matchEnd, matchEnd + 200);
    if (snippet.includes('DataTypes.VIRTUAL')) continue;

    attributes.push(key);
  }

  return { file: path.basename(filePath), tableName, paranoid, attributes };
}

// ─── DB column fetch ─────────────────────────────────────────────────────────

async function getTableColumns(table: string): Promise<string[]> {
  try {
    const rows = await sequelize.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :table
       ORDER BY ORDINAL_POSITION`,
      {
        replacements: { db: process.env.DB_NAME, table },
        type: QueryTypes.SELECT
      }
    ) as any[];
    return rows.map(r => r.COLUMN_NAME as string);
  } catch {
    return [];
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  await sequelize.authenticate();

  const modelsDir = path.resolve(__dirname, '../models');
  const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.ts'));

  let errors = 0;
  const results: string[] = [];

  for (const file of files) {
    const meta = extractModelMeta(path.join(modelsDir, file));
    if (!meta) continue;

    const dbCols = await getTableColumns(meta.tableName);
    if (dbCols.length === 0) {
      results.push(`⚠️  ${file} → table \`${meta.tableName}\` not found in DB (skip)`);
      continue;
    }

    const issues: string[] = [];

    // 1. paranoid: true without deleted_at
    if (meta.paranoid && !dbCols.includes('deleted_at')) {
      issues.push(`paranoid: true but \`deleted_at\` column missing`);
      errors++;
    }

    // 2. Model attributes declared but missing from DB
    // Map camelCase model keys → snake_case for comparison
    const toSnake = (s: string) => s.replace(/([A-Z])/g, '_$1').toLowerCase();
    const dbSet = new Set(dbCols);

    for (const attr of meta.attributes) {
      const snake = toSnake(attr);
      // Skip Sequelize virtual/meta attributes
      if (['createdAt', 'updatedAt', 'deletedAt'].includes(attr)) continue;
      if (!dbSet.has(attr) && !dbSet.has(snake)) {
        issues.push(`attribute \`${attr}\` (or \`${snake}\`) not in table`);
        errors++;
      }
    }

    if (issues.length > 0) {
      results.push(`❌  ${file} → \`${meta.tableName}\``);
      issues.forEach(i => results.push(`      • ${i}`));
    } else {
      results.push(`✅  ${file} → \`${meta.tableName}\` (${dbCols.length} cols)`);
    }
  }

  console.log('\n═══ Schema Validation ═══════════════════════════════════');
  results.forEach(r => console.log(r));
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n${errors === 0 ? '✅ All models match DB schema.' : `❌ ${errors} issue(s) found.`}\n`);

  await sequelize.close();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
