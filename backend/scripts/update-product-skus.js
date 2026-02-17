const { Product, Brand } = require('../models');
const skuConfig = require('../config/sku');

/**
 * Script para actualizar los SKUs de todos los productos
 * Remueve el tipo de presentación del SKU y usa unit_size del producto
 */

async function updateProductSKUs() {
  try {
    console.log('🔄 Iniciando actualización de SKUs...\n');

    // Obtener todos los productos
    const products = await Product.findAll({
      include: [
        { model: Brand, as: 'brand' }
      ]
    });

    console.log(`📦 Encontrados ${products.length} productos\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const product of products) {
      try {
        const oldSku = product.sku;

        // Generar nuevo SKU
        const newSku = skuConfig.generate({
          brandName: product.brand?.name || null,
          productName: product.name,
          unit_size: product.unit_size || null,
          unit_size_measure: product.unit_size_measure || 'UND',
          brand_id: product.brand_id,
          existingSku: oldSku // Preserva el hash si es posible
        });

        if (oldSku !== newSku) {
          await product.update({ sku: newSku });
          console.log(`✅ Actualizado: ${product.name}`);
          console.log(`   Antiguo: ${oldSku}`);
          console.log(`   Nuevo:   ${newSku}\n`);
          updated++;
        } else {
          console.log(`⏭️  Sin cambios: ${product.name} (${oldSku})\n`);
          skipped++;
        }
      } catch (error) {
        console.error(`❌ Error actualizando producto ${product.id} (${product.name}):`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Resumen:');
    console.log(`   ✅ Actualizados: ${updated}`);
    console.log(`   ⏭️  Sin cambios: ${skipped}`);
    console.log(`   ❌ Errores: ${errors}`);
    console.log(`   📦 Total: ${products.length}\n`);

    console.log('✨ Actualización completada\n');
  } catch (error) {
    console.error('❌ Error general:', error);
    process.exit(1);
  }
}

// Ejecutar el script
updateProductSKUs()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
