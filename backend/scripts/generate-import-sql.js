'use strict';

/**
 * Generador de SQL para importación de productos
 * Lee plantilla_productos.csv y genera productos_import.sql
 *
 * Uso: node backend/scripts/generate-import-sql.js
 */

const fs = require('fs');
const path = require('path');
const skuConfig = require('../config/sku');

// ============================================================
// Función de similitud (Levenshtein distance)
// ============================================================
function levenshteinDistance(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(0));

  for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[s2.length][s1.length];
}

function findSimilarBrand(brandName, existingBrands, threshold = 2) {
  if (!brandName) return null;

  let bestMatch = null;
  let bestDistance = threshold;

  for (const existing of existingBrands) {
    const distance = levenshteinDistance(brandName, existing);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = existing;
    }
  }

  return bestMatch;
}

// ============================================================
// Marcas base conocidas (de referencias comerciales comunes)
// ============================================================
const KNOWN_BRANDS = [
  'Coca-Cola', 'Pepsi', 'Fanta', 'Sprite', 'Nestlé', 'Kraft', 'PepsiCo',
  'Danone', 'Alpina', 'Colgate', 'Crest', 'Oral-B', 'Palmolive', 'Dove',
  'Ariel', 'Persil', 'Axion', 'Skip', 'Ace', 'Cloro', 'Clorox',
  'Johnson & Johnson', 'Procter & Gamble', 'Unilever', 'Henckels',
  'Protex', 'Dettol', 'Listerine', 'Aquafresh', 'Signal'
];

// ============================================================
// Parser CSV (maneja campos entre comillas con comas internas)
// ============================================================
function parseCSVLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(field.trim());
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field.trim());
  return fields;
}

// ============================================================
// Normalización de tipos de empaque
// ============================================================
const PACKAGING_MAP = {
  'BULTOS': 'BULTO',
  'BANDEJAS': 'BANDEJA',
  'BADEJA': 'BANDEJA',
  'CAJITA': 'CAJA',
  'BLESTER': 'CAJA',
  'PAQUETES': 'PAQUETE',
  'PAQ': 'PAQUETE',
  'CASJA': 'CAJA',
  'BULTO': 'BULTO',
  'BANDEJA': 'BANDEJA',
  'CAJA': 'CAJA',
  'BOLSA': 'BOLSA',
  'PAQUETE': 'PAQUETE',
};

function normalizePackaging(value) {
  if (!value) return 'CAJA';
  // Si tiene múltiples valores separados por coma, tomar el primero
  const first = value.split(',')[0].trim();
  const upper = first.replace(/\s+/g, '').toUpperCase();
  return PACKAGING_MAP[upper] || first.toUpperCase();
}

// ============================================================
// Parsear precio (eliminar comas de miles como en COP)
// ============================================================
function parsePrice(value) {
  if (!value || value.trim() === '') return '0';
  let v = value.replace(/"/g, '').trim();
  // Detectar formato COP: "68,000" → tiene coma entre dígitos con 3 dígitos al final
  if (/\d,\d{3}/.test(v)) {
    v = v.replace(/,/g, '');
  }
  const num = parseFloat(v);
  if (isNaN(num)) return '0';
  return String(num);
}

// ============================================================
// Detectar moneda de compra
// ============================================================
function detectCurrency(rawCurrency, rawPrice) {
  if (rawCurrency && rawCurrency.trim()) {
    const first = rawCurrency.split(',')[0].trim().toUpperCase();
    if (first === 'USD' || first === 'COP' || first === 'VES') return first;
    // Manejar variantes: "Usd", "usd"
    if (first.startsWith('U')) return 'USD';
    if (first.startsWith('C')) return 'COP';
    if (first.startsWith('V')) return 'VES';
  }
  // Deducir por formato del precio crudo
  if (rawPrice && /\d,\d{3}/.test(rawPrice)) return 'COP';
  return 'USD';
}

// ============================================================
// Escapar valores para SQL
// ============================================================
function esc(value) {
  if (value === null || value === undefined || value === '') return 'NULL';
  return "'" + String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '') + "'";
}

// ============================================================
// Generar código de categoría (3-5 letras, único)
// ============================================================
const usedCodes = new Set();

function generateCategoryCode(name) {
  const normalized = name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z\s]/g, '')
    .trim();

  const words = normalized.split(/\s+/).filter(w => w.length > 0);

  let base;
  if (words.length === 1) {
    base = words[0].substring(0, 5);
  } else {
    // Iniciales de cada palabra
    base = words.map(w => w[0]).join('').substring(0, 5);
    if (base.length < 3) {
      base = words[0].substring(0, 5);
    }
  }

  // Resolver colisiones con sufijo numérico
  let code = base;
  let suffix = 1;
  while (usedCodes.has(code)) {
    code = base.substring(0, 4) + suffix;
    suffix++;
  }

  usedCodes.add(code);
  return code;
}

// ============================================================
// MAIN
// ============================================================
// Buscar CSV en public/ o en la raíz del proyecto
const csvInPublic = path.join(__dirname, '../public/plantilla_productos.csv');
const csvInRoot = path.join(__dirname, '../../plantilla_productos.csv');
const csvPath = fs.existsSync(csvInPublic) ? csvInPublic : csvInRoot;
const outputPath = path.join(__dirname, '../../productos_import.sql');

if (!fs.existsSync(csvPath)) {
  console.error(`❌ No se encontró el CSV en:\n   ${csvInPublic}\n   ${csvInRoot}`);
  process.exit(1);
}

const csvContent = fs.readFileSync(csvPath, 'utf8');
const lines = csvContent.split('\n').filter(l => l.trim());

// Saltar fila 0 (encabezado) y fila 1 (ejemplo/plantilla)
const dataRows = lines.slice(2)
  .map(l => parseCSVLine(l))
  .filter(r => r.length > 1 && r[1] && r[1].trim());

// ============================================================
// Mapear categorías nuevas a categorías existentes
// ============================================================
const CATEGORY_MAP = {
  // → Higiene (existente)
  'Afeitadoras': 'Higiene',
  'Champu': 'Higiene',
  'Crema Dental': 'Higiene',
  'Higiene': 'Higiene',
  'Papel Higienico': 'Higiene',
  'Shampoo': 'Higiene',
  'Toallas higienicas': 'Higiene',

  // → Limpieza (existente)
  'Baigon': 'Limpieza',
  'Cloro': 'Limpieza',
  'Coletos limpieza': 'Limpieza',
  'Detergente': 'Limpieza',
  'Jabon': 'Limpieza',
  'Jabones': 'Limpieza',
  'Servilletas': 'Limpieza',
  'Suavisante detergente': 'Limpieza',
  'Toallin': 'Limpieza',
  'Trapo': 'Limpieza',

  // → Categorías existentes
  'Aceite': 'Aceites',
  'Arroz': 'Granos',
  'Atun': 'Enlatados',
  'Avena': 'Granos',
  'Caramelos': 'Chucherías',
  'Cereales': 'Granos',
  'Chocolates': 'Chucherías',
  'Chupetas': 'Chucherías',
  'Confites': 'Chucherías',
  'Confittes': 'Chucherías',
  'Crema de leche': 'Lácteos',
  'Enlatados': 'Enlatados',
  'Galletas': 'Chucherías',
  'Granos': 'Granos',
  'Jugos': 'Bebidas',
  'Leche Condensada': 'Lácteos',
  'Leche Evaporada': 'Lácteos',
  'Leche liquida': 'Lácteos',
  'Leche polvo': 'Lácteos',
  'Maltas': 'Bebidas',
  'Sardina': 'Enlatados',
  'Te': 'Bebidas',
  'Toddy': 'Bebidas',
  'Tomates': 'Enlatados',
};

function mapCategory(catName) {
  return CATEGORY_MAP[catName] || 'Comestible';
}

// ============================================================
// Recolectar datos únicos
// ============================================================
const categories = new Map();   // name → code
const brands = new Set();
const packagingTypes = new Set();

// Agregar categoría Comestible si se necesita
categories.set('Comestible', 'COMES');
// Agregar categorías existentes conocidas (para evitar duplicados)
categories.set('Lácteos', 'LAC');
categories.set('Granos', 'GRA');
categories.set('Aceites', 'ACE');
categories.set('Bebidas', 'BEB');
categories.set('Enlatados', 'ENL');
categories.set('Limpieza', 'LIM');
categories.set('Higiene', 'HIG');
categories.set('Chucherías', 'CHU');

for (const row of dataRows) {
  let catName = (row[3] || '').trim() || 'General';
  // Mapear a categoría existente
  catName = mapCategory(catName);

  let brandName = (row[4] || '').trim();
  const packagingRaw = (row[13] || '').trim();

  if (!categories.has(catName)) {
    categories.set(catName, generateCategoryCode(catName));
  }

  // MATCHING DE MARCAS: Buscar similar entre marcas conocidas
  if (brandName) {
    const similarKnown = findSimilarBrand(brandName, KNOWN_BRANDS, 2);
    const similarExisting = findSimilarBrand(brandName, Array.from(brands), 2);

    // Usar la marca similar si existe en las conocidas
    if (similarKnown) {
      brandName = similarKnown;
    } else if (similarExisting) {
      // Usar la marca ya recolectada si es similar
      brandName = similarExisting;
    }

    brands.add(brandName);
  }

  if (packagingRaw) packagingTypes.add(normalizePackaging(packagingRaw));
}

// ============================================================
// OPCIÓN C: Pre-procesar nombre de producto para remover marca
// ============================================================
function removeProductBrandReference(productName, brandName) {
  if (!brandName || !productName) return productName;

  // Remover referencias a la marca en el nombre del producto
  // Ej: "Aceite Vegetal Vatel" + brand="Vatel" → "Aceite Vegetal"
  const nameRegex = new RegExp(`\\b${brandName}\\b`, 'gi');
  const cleaned = productName.replace(nameRegex, '').trim();

  return cleaned || productName; // si quedaría vacío, devolver original
}

// ============================================================
// NORMALIZAR MARCAS: Una sola vez, para consistencia global
// ============================================================
// Mapeo: brandName original → brandName normalizado
const brandNormalizationMap = new Map();

for (const row of dataRows) {
  let brandName = (row[4] || '').trim() || '';

  if (brandName && !brandNormalizationMap.has(brandName)) {
    let normalized = brandName;

    // MATCHING DE MARCAS: Buscar similar
    const similarKnown = findSimilarBrand(brandName, KNOWN_BRANDS, 2);
    const similarExisting = findSimilarBrand(brandName, Array.from(brands), 2);

    if (similarKnown) {
      normalized = similarKnown;
    } else if (similarExisting) {
      normalized = similarExisting;
    }

    brandNormalizationMap.set(brandName, normalized);
  }
}

// ============================================================
// Generar SKUs (deterministas: sin timestamp)
// ============================================================
// Índice: productName|brandName (NORMALIZADO) → sku generado
const skuMap = new Map();
// Verificar duplicados de SKU (si dos productos generan el mismo SKU, agregar sufijo)
const usedSkus = new Map(); // sku → count

// Usar Opción B por defecto (remover marca redundante en sku.js)
// Descomentar línea siguiente para activar Opción C (pre-procesar en script):
const USE_OPTION_C = false; // true para Opción C, false para Opción B (DEFECTO)

for (const row of dataRows) {
  let productName = (row[1] || '').trim();
  let brandName = (row[4] || '').trim() || '';
  const unitSize = (row[10] || '').trim() || null;
  const unitMeasure = (row[11] || '').trim() || 'UND';

  // Usar marca normalizada
  brandName = brandNormalizationMap.get(brandName) || brandName;

  // OPCIÓN C: Pre-procesar si está habilitada
  if (USE_OPTION_C) {
    productName = removeProductBrandReference(productName, brandName);
  }

  const key = `${productName}|${brandName}`;
  if (skuMap.has(key)) continue; // ya procesado (producto duplicado en CSV)

  // Generar SKU determinista usando 'PLACEHOLDER' como existingSku
  // Esto fuerza hash sin timestamp (determinista)
  const sku = skuConfig.generate({
    brandName: brandName || '',
    productName,
    unit_size: unitSize,
    unit_size_measure: unitMeasure,
    brand_id: null,
    existingSku: 'PLACEHOLDER'
  });

  // Manejar colisiones de SKU
  if (usedSkus.has(sku)) {
    const count = usedSkus.get(sku) + 1;
    usedSkus.set(sku, count);
    skuMap.set(key, `${sku}-${count}`);
  } else {
    usedSkus.set(sku, 1);
    skuMap.set(key, sku);
  }
}

// ============================================================
// Construir SQL
// ============================================================
const lines_sql = [];

lines_sql.push('-- =========================================================');
lines_sql.push('-- Importación de Productos desde plantilla_productos.csv');
lines_sql.push(`-- Generado: ${new Date().toISOString()}`);
lines_sql.push(`-- Productos: ${dataRows.length} | Categorías: ${categories.size} | Marcas: ${brands.size}`);
lines_sql.push('-- =========================================================');
lines_sql.push('');
lines_sql.push('SET NAMES utf8mb4;');
lines_sql.push('SET foreign_key_checks = 0;');
lines_sql.push('');

// 1. CATEGORÍAS (solo la nueva: Comestible)
lines_sql.push('-- ---------------------------------------------------------');
lines_sql.push('-- 1. CATEGORÍAS');
lines_sql.push('-- ---------------------------------------------------------');
lines_sql.push(
  `INSERT IGNORE INTO categories (code, name, description, is_active, created_at, updated_at) ` +
  `VALUES ('COMES', 'Comestible', 'Productos comestibles variados importados desde plantilla', 1, NOW(), NOW());`
);
lines_sql.push('-- Otras categorías ya existen en la BD: Lácteos, Granos, Aceites, Bebidas, Enlatados, Limpieza, Higiene, Chucherías');
lines_sql.push('');

// 2. MARCAS
lines_sql.push('-- ---------------------------------------------------------');
lines_sql.push('-- 2. MARCAS');
lines_sql.push('-- ---------------------------------------------------------');
for (const brand of brands) {
  lines_sql.push(
    `INSERT IGNORE INTO brands (name, is_active, created_by, created_at, updated_at) ` +
    `VALUES (${esc(brand)}, 1, 1, NOW(), NOW());`
  );
}
lines_sql.push('');

// 3. TIPOS DE EMPAQUE
lines_sql.push('-- ---------------------------------------------------------');
lines_sql.push('-- 3. TIPOS DE EMPAQUE');
lines_sql.push('-- ---------------------------------------------------------');
for (const pt of packagingTypes) {
  lines_sql.push(
    `INSERT IGNORE INTO packaging_types (name, is_active, created_at, updated_at) ` +
    `VALUES (${esc(pt)}, 1, NOW(), NOW());`
  );
}
lines_sql.push('');

// 4. PRODUCTOS
lines_sql.push('-- ---------------------------------------------------------');
lines_sql.push('-- 4. PRODUCTOS');
lines_sql.push('-- ---------------------------------------------------------');

// Deduplicar por productName|brandName (tomar la primera aparición)
const seenProducts = new Set();

for (const row of dataRows) {
  const productName = (row[1] || '').trim();
  const description = (row[2] || '').trim() || null;
  let catName = (row[3] || '').trim() || 'General';
  catName = mapCategory(catName);  // Mapear a categoría existente
  const brandNameStr = (row[4] || '').trim(); // '' si vacío (ORIGINAL)
  // Usar marca normalizada (consistente con skuMap)
  const brandNameNorm = brandNormalizationMap.get(brandNameStr) || brandNameStr;
  const brandName = brandNameNorm || null;     // null para SQL
  const minStock = parseInt(row[7]) || 0;
  const maxStock = parseInt(row[8]) || 0;
  const reorderPoint = parseInt(row[9]) || 0;
  const unitSize = (row[10] || '').trim() || null;
  const unitMeasure = (row[11] || '').trim() || 'UND';

  // Clave consistente con skuMap (usa brandNameNorm, NO brandNameStr original)
  const key = `${productName}|${brandNameNorm}`;
  if (seenProducts.has(key)) continue;
  seenProducts.add(key);

  const sku = skuMap.get(key);
  const unitSizeSql = unitSize ? parseFloat(unitSize) : 'NULL';
  const categorySubquery = `(SELECT id FROM categories WHERE name = ${esc(catName)} LIMIT 1)`;
  const brandSubquery = brandName
    ? `(SELECT id FROM brands WHERE name = ${esc(brandName)} LIMIT 1)`
    : 'NULL';

  lines_sql.push(
    `INSERT IGNORE INTO products\n` +
    `  (sku, name, description, category_id, brand_id,\n` +
    `   is_perishable, has_batch_control, min_stock, max_stock, reorder_point,\n` +
    `   unit_size, unit_size_measure, is_active, created_by, created_at, updated_at)\n` +
    `  VALUES (\n` +
    `    ${esc(sku)}, ${esc(productName)}, ${description ? esc(description) : 'NULL'},\n` +
    `    ${categorySubquery},\n` +
    `    ${brandSubquery},\n` +
    `    0, 0, ${minStock}, ${maxStock}, ${reorderPoint},\n` +
    `    ${unitSizeSql}, ${esc(unitMeasure)},\n` +
    `    1, 1, NOW(), NOW()\n` +
    `  );`
  );
}
lines_sql.push('');

// 5. PRESENTACIONES
lines_sql.push('-- ---------------------------------------------------------');
lines_sql.push('-- 5. PRESENTACIONES DE PRODUCTOS');
lines_sql.push('-- ---------------------------------------------------------');

for (const row of dataRows) {
  const productName = (row[1] || '').trim();
  const brandNameStr = (row[4] || '').trim(); // '' si vacío (ORIGINAL)
  // Usar marca normalizada (consistente con skuMap)
  const brandNameNorm = brandNormalizationMap.get(brandNameStr) || brandNameStr;
  const presentName = (row[12] || '').trim();
  const packagingRaw = (row[13] || '').trim();
  const unitsPerPackage = parseInt(row[14]) || 1;
  // Si unidades por presentación está vacío, usar unidades por empaque
  const unitsPerPresentation = parseFloat(row[15]) || parseFloat(row[14]) || 1;
  const rawPackagePrice = row[16] || '';
  const rawPackageCost = row[17] || '';
  const rawUnitPrice = row[18] || '';
  const rawUnitCost = row[19] || '';
  const rawCurrency = row[20] || '';
  const isDefault = (row[21] || '').trim().toUpperCase() === 'SI' ? 1 : 0;

  if (!presentName) continue;

  const currency = detectCurrency(rawCurrency, rawPackagePrice || rawPackageCost);
  const packagingNorm = packagingRaw ? normalizePackaging(packagingRaw) : null;
  const packagePrice = parsePrice(rawPackagePrice);
  const packageCost = parsePrice(rawPackageCost);
  const basePrice = parsePrice(rawUnitPrice);
  const cost = parsePrice(rawUnitCost);

  const key = `${productName}|${brandNameNorm}`;
  const sku = skuMap.get(key);

  // IMPORTANTE: Si el SKU no existe, es un error en los datos. No debe pasar.
  if (!sku) {
    throw new Error(`❌ ERROR CRÍTICO: Presentación sin producto correspondiente.\n` +
      `   Producto: "${productName}"\n` +
      `   Marca: "${brandNameStr}" (normalizada: "${brandNameNorm}")\n` +
      `   Presentación: "${presentName}"\n` +
      `   La presentación requiere que el producto exista en la sección 4.`);
  }

  const productSubquery = `(SELECT id FROM products WHERE sku = ${esc(sku)} LIMIT 1)`;
  const packagingSubquery = packagingNorm
    ? `(SELECT id FROM packaging_types WHERE name = ${esc(packagingNorm)} LIMIT 1)`
    : 'NULL';

  lines_sql.push(
    `INSERT INTO product_presentations\n` +
    `  (product_id, packaging_type_id, name,\n` +
    `   units_per_package, units_per_presentation,\n` +
    `   package_price, package_cost, base_price, cost,\n` +
    `   purchase_currency, is_default, is_active, created_at, updated_at)\n` +
    `  VALUES (\n` +
    `    ${productSubquery},\n` +
    `    ${packagingSubquery},\n` +
    `    ${esc(presentName)},\n` +
    `    ${unitsPerPackage}, ${unitsPerPresentation},\n` +
    `    ${packagePrice}, ${packageCost}, ${basePrice}, ${cost},\n` +
    `    ${esc(currency)}, ${isDefault}, 1, NOW(), NOW()\n` +
    `  );`
  );
}
lines_sql.push('');
lines_sql.push('SET foreign_key_checks = 1;');
lines_sql.push('');
lines_sql.push('-- Fin de la importación');

// ============================================================
// Escribir archivo
// ============================================================
const sqlContent = lines_sql.join('\n');
fs.writeFileSync(outputPath, sqlContent, 'utf8');

console.log(`✅ SQL generado exitosamente: ${outputPath}`);
console.log(`   Categorías  : ${categories.size}`);
console.log(`   Marcas      : ${brands.size}`);
console.log(`   Tipos empaque: ${packagingTypes.size}`);
console.log(`   Productos   : ${seenProducts.size}`);
console.log(`   Presentaciones: ${dataRows.filter(r => r[12] && r[12].trim()).length}`);
console.log('');
console.log('Para ejecutar en la BD:');
console.log('  docker exec -i lobo-mysql mysql -u lobo_user -p"CONTRASEÑA" DB_NAME < productos_import.sql');
