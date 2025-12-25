const { Product, Category, sequelize } = require('../models');
const skuConfig = require('../config/sku');

/**
 * Script para regenerar todos los SKUs de productos
 *
 * Este script:
 * 1. Obtiene todos los productos ordenados por categoría y ID
 * 2. Regenera el SKU para cada producto basado en su categoría
 * 3. Actualiza cada producto con el nuevo SKU
 *
 * Ejecutar: node backend/scripts/regenerateAllSKUs.js
 */

async function regenerateAllSKUs() {
  const transaction = await sequelize.transaction();

  try {
    console.log('🔄 Iniciando regeneración de SKUs...\n');

    // Obtener todas las categorías
    const categories = await Category.findAll({
      order: [['code', 'ASC']]
    });

    if (categories.length === 0) {
      console.log('⚠️  No hay categorías en la base de datos');
      await transaction.rollback();
      return;
    }

    let totalUpdated = 0;
    const updateLog = [];

    // Procesar productos por categoría
    for (const category of categories) {
      console.log(`📦 Procesando categoría: ${category.name} (${category.code})`);

      // Obtener productos de esta categoría ordenados por ID
      const products = await Product.findAll({
        where: { category_id: category.id },
        order: [['id', 'ASC']],
        transaction
      });

      if (products.length === 0) {
        console.log(`   ℹ️  No hay productos en esta categoría\n`);
        continue;
      }

      // Regenerar SKU para cada producto
      let sequence = skuConfig.startFrom;
      for (const product of products) {
        const oldSKU = product.sku;
        const newSKU = skuConfig.generate(category.code, sequence);

        if (oldSKU !== newSKU) {
          await product.update({ sku: newSKU }, { transaction });

          updateLog.push({
            id: product.id,
            name: product.name,
            category: category.name,
            oldSKU,
            newSKU
          });

          console.log(`   ✅ ID ${product.id}: ${oldSKU} → ${newSKU}`);
          totalUpdated++;
        } else {
          console.log(`   ⏭️  ID ${product.id}: ${oldSKU} (sin cambios)`);
        }

        sequence++;
      }

      console.log(`   📊 Total productos en ${category.name}: ${products.length}\n`);
    }

    // Commit transaction
    await transaction.commit();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ REGENERACIÓN COMPLETADA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Total de productos actualizados: ${totalUpdated}`);
    console.log(`📋 Total de productos sin cambios: ${await Product.count() - totalUpdated}`);

    if (updateLog.length > 0) {
      console.log('\n📝 RESUMEN DE CAMBIOS:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      updateLog.forEach(log => {
        console.log(`ID ${log.id} | ${log.category} | ${log.name}`);
        console.log(`  Antes: ${log.oldSKU}`);
        console.log(`  Después: ${log.newSKU}\n`);
      });
    }

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error regenerando SKUs:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar
regenerateAllSKUs();
