const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config();
const { sequelize } = require('../config/database');
const { Product, Category, PriceList, PriceListDetail, ProductPresentation } = require('../models');

/**
 * Script para importar productos desde el archivo Excel
 * LISTA DE PRECIOS.xlsx
 */

// Función para parsear el peso y extraer valor y unidad
function parseWeight(weightStr) {
  if (!weightStr) return { value: null, unit: 'UND' };

  const str = weightStr.toString().replace(',', '.').trim();

  // Buscar patrones como "850ML", "1LT", "900GR", etc.
  const match = str.match(/([0-9.]+)\s*([A-Z]+)/i);

  if (match) {
    const value = parseFloat(match[1]);
    let unit = match[2].toUpperCase();

    // Normalizar unidades
    const unitMap = {
      'ML': 'ML',
      'LT': 'LT',
      'LTR': 'LT',
      'L': 'LT',
      'GR': 'GR',
      'G': 'GR',
      'KG': 'KG',
      'KILO': 'KG',
      'CC': 'ML',
      'OZ': 'OZ',
      'LB': 'LB'
    };

    unit = unitMap[unit] || unit;

    return { value, unit };
  }

  return { value: null, unit: 'UND' };
}

// Función para generar SKU único
function generateSKU(brand, description, weight) {
  const brandPart = (brand || 'GEN').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
  const descPart = description.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
  const weightPart = weight.replace(/[^0-9]/g, '').substring(0, 4).padStart(4, '0');
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();

  return `${brandPart}${descPart}${weightPart}${random}`;
}

// Función para normalizar nombres de categorías
function normalizeCategoryName(category) {
  const categoryMap = {
    'COMESTIBLE': 'Alimentos',
    'LIMPIEZA': 'Limpieza',
    'ASEO PERSONAL': 'Aseo Personal',
    'BEBIDAS': 'Bebidas',
    'LACTEOS': 'Lácteos',
    'GRANOS': 'Granos y Cereales',
    'ENLATADOS': 'Enlatados',
    'CONDIMENTOS': 'Condimentos y Especias'
  };

  return categoryMap[category] || 'Varios';
}

async function importProducts() {
  try {
    console.log('=== INICIANDO IMPORTACIÓN DE PRODUCTOS ===\n');

    // Conectar a la base de datos
    await sequelize.authenticate();
    console.log('✓ Conexión a la base de datos exitosa\n');

    // Leer el archivo Excel
    const filePath = path.join(__dirname, '../../LISTA DE PRECIOS.xlsx');
    console.log(`Leyendo archivo: ${filePath}\n`);
    const workbook = XLSX.readFile(filePath);

    // Obtener la hoja "LISTA DE PRODUCTOS DETALLADOS"
    const productSheet = workbook.Sheets['LISTA DE PRODUCTOS DETALLADOS'];
    const productData = XLSX.utils.sheet_to_json(productSheet);
    console.log(`✓ ${productData.length} productos encontrados en la hoja de productos\n`);

    // Obtener la hoja "HOJA DE PRECIOS USD" para los precios
    const priceSheet = workbook.Sheets['HOJA DE PRECIOS USD'];
    const priceData = XLSX.utils.sheet_to_json(priceSheet);
    console.log(`✓ ${priceData.length} productos encontrados en la hoja de precios\n`);

    // Crear un mapa de precios por nombre de producto
    const priceMap = new Map();
    priceData.forEach(item => {
      const productName = item['PRODUCTOS'] || '';
      priceMap.set(productName.toLowerCase().trim(), {
        unitsPerPackage: item['UNI/BT'] || 1,
        priceUSD: item['PRECIOS USD'] || 0,
        priceVES: item['PRECIOS VES'] || 0,
        priceCOP: item['PRECIOS COP'] || 0,
        unitPrice: item['PRECIO UNITARIO'] || 0
      });
    });

    // Obtener todas las categorías existentes
    const categories = await Category.findAll();
    const categoryMap = new Map();
    categories.forEach(cat => {
      categoryMap.set(cat.name.toLowerCase(), cat);
    });

    console.log(`✓ ${categories.length} categorías encontradas en la base de datos\n`);

    // Si no hay categorías, crear algunas básicas
    if (categories.length === 0) {
      console.log('Creando categorías básicas...\n');
      const basicCategories = [
        { name: 'Alimentos', description: 'Productos alimenticios', is_active: true },
        { name: 'Bebidas', description: 'Bebidas y líquidos', is_active: true },
        { name: 'Limpieza', description: 'Productos de limpieza', is_active: true },
        { name: 'Aseo Personal', description: 'Productos de aseo personal', is_active: true },
        { name: 'Lácteos', description: 'Productos lácteos', is_active: true },
        { name: 'Granos y Cereales', description: 'Granos, cereales y legumbres', is_active: true },
        { name: 'Enlatados', description: 'Productos enlatados', is_active: true },
        { name: 'Condimentos y Especias', description: 'Condimentos, especias y salsas', is_active: true },
        { name: 'Varios', description: 'Productos varios', is_active: true }
      ];

      for (const catData of basicCategories) {
        const cat = await Category.create(catData);
        categoryMap.set(cat.name.toLowerCase(), cat);
      }

      console.log(`✓ ${basicCategories.length} categorías creadas\n`);
    }

    // Obtener el ID del usuario admin (asumimos que es el ID 1)
    const adminUserId = 1;

    // Estadísticas
    let created = 0;
    let skipped = 0;
    let errors = 0;

    console.log('Procesando productos...\n');

    for (const item of productData) {
      try {
        const description = item['DESCRIPPCCION DE PRODUCTOS'] || '';
        const brand = item['MARCA'] || '';
        const weight = item['PESO'] || '';
        const unitsPerLot = item['UNIDAD'] || 1;
        const packageType = item['TIPO DE EMPAQUE POR LOTE'] || '';
        const presentation = item['PRECENTACION'] || '';
        const category = item['CATEGORIA'] || 'COMESTIBLE';

        if (!description.trim()) {
          skipped++;
          continue;
        }

        // Parsear el peso
        const parsedWeight = parseWeight(weight);

        // Generar SKU único
        const sku = generateSKU(brand, description, weight);

        // Verificar si el producto ya existe
        const existingProduct = await Product.findOne({ where: { sku } });
        if (existingProduct) {
          skipped++;
          continue;
        }

        // Determinar la categoría
        const normalizedCategory = normalizeCategoryName(category.toUpperCase());
        let categoryId = categoryMap.get(normalizedCategory.toLowerCase())?.id;

        if (!categoryId) {
          // Usar categoría "Varios" como fallback
          categoryId = categoryMap.get('varios')?.id || categories[0]?.id;
        }

        // Construir el nombre del producto
        let productName = `${description.trim()}`;
        if (brand) {
          productName += ` ${brand}`;
        }
        if (weight) {
          productName += ` ${weight}`;
        }

        // Buscar precios en el mapa
        const priceInfo = priceMap.get(productName.toLowerCase().trim());

        // Crear el producto
        const product = await Product.create({
          sku,
          name: productName.substring(0, 200),
          description: `${description} - Marca: ${brand || 'N/A'} - Presentación: ${presentation} - Empaque: ${packageType}`,
          category_id: categoryId,
          brand_id: null, // Ahora usa brand_id
          unit_of_measure: parsedWeight.unit || 'UND',
          is_perishable: category.toUpperCase().includes('COMESTIBLE') || category.toUpperCase().includes('LACTEOS'),
          min_stock: unitsPerLot * 2,
          max_stock: unitsPerLot * 10,
          reorder_point: unitsPerLot * 3,
          is_active: true,
          created_by: adminUserId,
          updated_by: adminUserId
        });

        // Crear una presentación por defecto para el producto
        const productPresentation = await ProductPresentation.create({
          product_id: product.id,
          name: presentation || 'Unidad',
          units_per_package: unitsPerLot,
          package_cost: 0,
          package_price: priceInfo?.priceUSD || 0,
          is_active: true
        });

        // Si hay información de precios, vincular a la lista Minorista
        if (priceInfo) {
          const retailList = await PriceList.findOne({ where: { code: 'LP-0001' } });

          if (retailList) {
            await PriceListDetail.create({
              price_list_id: retailList.id,
              product_id: product.id,
              presentation_id: productPresentation.id,
              package_cost: 0,
              unit_cost: 0,
              package_price: priceInfo.priceUSD,
              unit_price: priceInfo.priceUSD / unitsPerLot,
              margin_percentage: 0
            });
          }
        }

        created++;
        console.log(`✓ [${created}/${productData.length}] ${productName}`);

      } catch (error) {
        errors++;
        console.error(`✗ Error procesando producto: ${error.message}`);
      }
    }

    console.log('\n=== RESUMEN DE IMPORTACIÓN ===');
    console.log(`Productos creados: ${created}`);
    console.log(`Productos omitidos: ${skipped}`);
    console.log(`Errores: ${errors}`);
    console.log(`Total procesados: ${productData.length}\n`);

  } catch (error) {
    console.error('Error en la importación:', error);
  } finally {
    await sequelize.close();
    console.log('✓ Conexión cerrada');
  }
}

// Ejecutar la importación
importProducts();
