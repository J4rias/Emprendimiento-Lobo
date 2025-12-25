const { Product, Brand, ProductPresentation, PresentationType, sequelize } = require('../models');
const skuConfig = require('../config/sku');

/**
 * Script para regenerar SKUs con nuevo formato descriptivo
 *
 * Formato: {BRAND_3_LETRAS}-{NOMBRE_CORTO}-{PRESENTACION}-{CONTENIDO}-{UOM}-{HASH4}
 * Ejemplo: POR-ACEITE-SOYA-850-ML-7F3A
 *
 * Ejecutar: node backend/scripts/regenerateNewFormatSKUs.js
 */

async function regenerateNewFormatSKUs() {
  const transaction = await sequelize.transaction();

  try {
    console.log('🔄 Iniciando regeneración de SKUs con nuevo formato...\n');
    console.log(`📋 Formato: ${skuConfig.format}\n`);

    // Obtener todos los productos con sus relaciones
    const products = await Product.findAll({
      include: [
        {
          model: Brand,
          as: 'brand'
        },
        {
          model: ProductPresentation,
          as: 'presentations',
          include: [
            {
              model: PresentationType,
              as: 'presentationType'
            }
          ]
        }
      ],
      order: [['id', 'ASC']],
      transaction
    });

    if (products.length === 0) {
      console.log('⚠️  No hay productos en la base de datos');
      await transaction.rollback();
      return;
    }

    const updateLog = [];
    let updated = 0;
    let skipped = 0;

    console.log(`📦 Total de productos a procesar: ${products.length}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const product of products) {
      try {
        const oldSKU = product.sku;
        const brandName = product.brand?.name || null;

        // Generar nuevo SKU (forzar regeneración de hash si el anterior no es válido)
        let existingSku = oldSKU;

        // Si el SKU antiguo tiene un hash que parece ser correlativo (solo números),
        // no preservarlo y generar uno nuevo
        if (oldSKU) {
          const parts = oldSKU.split('-');
          const lastPart = parts[parts.length - 1];
          // Si el hash contiene solo números (0001, 0002, etc.), no es un hash MD5 válido
          if (lastPart && lastPart.match(/^[0-9]+$/)) {
            existingSku = null; // Forzar generación de nuevo hash
          }
        }

        const newSKU = skuConfig.generate({
          brandName,
          productName: product.name,
          presentations: product.presentations,
          brand_id: product.brand_id,
          existingSku
        });

        if (oldSKU !== newSKU) {
          // Actualizar producto
          await product.update({ sku: newSKU }, { transaction });

          updateLog.push({
            id: product.id,
            name: product.name,
            brand: brandName || 'SIN MARCA',
            oldSKU,
            newSKU
          });

          updated++;
          console.log(`✅ ID ${String(product.id).padStart(3, ' ')} | ${newSKU}`);
          console.log(`   Antes: ${oldSKU}`);
          console.log(`   Marca: ${brandName || 'SIN MARCA'}`);
          console.log(`   Producto: ${product.name.substring(0, 60)}\n`);
        } else {
          skipped++;
          console.log(`⏭️  ID ${String(product.id).padStart(3, ' ')} | ${oldSKU} (sin cambios)\n`);
        }

      } catch (error) {
        console.error(`❌ Error procesando producto ID ${product.id}: ${error.message}`);
        console.error(`   Nombre: ${product.name}`);
        console.error(`   Marca: ${product.brand?.name || 'N/A'}\n`);
      }
    }

    // Commit transaction
    await transaction.commit();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ REGENERACIÓN COMPLETADA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Total procesados: ${products.length}`);
    console.log(`✅ Actualizados: ${updated}`);
    console.log(`⏭️  Sin cambios: ${skipped}`);

    if (updateLog.length > 0) {
      console.log('\n📝 EJEMPLOS DE CAMBIOS:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Mostrar primeros 10 ejemplos
      const examples = updateLog.slice(0, 10);
      examples.forEach(log => {
        console.log(`\n🔹 ID ${log.id} | ${log.brand}`);
        console.log(`   Producto: ${log.name.substring(0, 70)}`);
        console.log(`   Antes:    ${log.oldSKU}`);
        console.log(`   Después:  ${log.newSKU}`);
      });

      if (updateLog.length > 10) {
        console.log(`\n   ... y ${updateLog.length - 10} cambios más`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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
regenerateNewFormatSKUs();
