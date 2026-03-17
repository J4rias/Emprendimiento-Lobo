const {
  Product,
  ProductPresentation,
  SaleDetail,
  PurchaseOrderDetail,
  PriceListDetail,
  CreditNoteDetail,
  DeliveryDetail,
  TransferDetail,
  InventoryMovement
} = require('../models');
const { Op } = require('sequelize');

/**
 * Script para fusionar presentaciones duplicadas.
 *
 * Para cada producto con 2 presentaciones idénticas:
 * 1. Identifica la vieja (ID bajo, creada en febrero) vs nueva (ID alto, creada en marzo)
 * 2. Migra TODAS las referencias de la nueva hacia la vieja
 * 3. Elimina la nueva
 * 4. Asegura que quede una presentación con is_default=true
 */

async function mergeDuplicatePresentations() {
  try {
    console.log('🔧 Iniciando fusión de presentaciones duplicadas...\n');

    // Encontrar productos con exactamente 2 presentaciones
    const products = await Product.findAll({
      include: [{
        model: ProductPresentation,
        as: 'presentations',
        required: false
      }],
      raw: false
    });

    const duplicates = products.filter(p =>
      p.presentations && p.presentations.length === 2
    );

    console.log(`📋 Encontrados: ${duplicates.length} productos con 2 presentaciones\n`);

    let fusionadas = 0;
    let errores = 0;

    for (const product of duplicates) {
      const [pres1, pres2] = product.presentations.sort((a, b) => a.id - b.id);

      // La vieja tiene ID bajo, la nueva tiene ID alto
      const keepPresentation = pres1;
      const removePresentation = pres2;

      try {
        console.log(`\n📦 Producto: "${product.name}" (ID ${product.id})`);
        console.log(`   Mantener: ID ${keepPresentation.id} ("${keepPresentation.name}")`);
        console.log(`   Eliminar: ID ${removePresentation.id} ("${removePresentation.name}")`);

        // 1. Contar referencias de la presentación a eliminar
        const [
          saleCount,
          poCount,
          priceCount,
          creditCount,
          deliveryCount,
          transferCount,
          movementCount
        ] = await Promise.all([
          SaleDetail.count({ where: { presentation_id: removePresentation.id } }),
          PurchaseOrderDetail.count({ where: { presentation_id: removePresentation.id } }),
          PriceListDetail.count({ where: { presentation_id: removePresentation.id } }),
          CreditNoteDetail.count({ where: { presentation_id: removePresentation.id } }),
          DeliveryDetail.count({ where: { presentation_id: removePresentation.id } }),
          TransferDetail.count({ where: { presentation_id: removePresentation.id } }),
          InventoryMovement.count({ where: { presentation_id: removePresentation.id } })
        ]);

        console.log(`   Referencias: ventas=${saleCount}, OC=${poCount}, precios=${priceCount}, NC=${creditCount}, entregas=${deliveryCount}, transferencias=${transferCount}, movimientos=${movementCount}`);

        // 2. Eliminar references from PriceListDetail (tiene constraint único, no podemos migrar)
        const priceListDeleted = await PriceListDetail.destroy({
          where: { presentation_id: removePresentation.id }
        });
        if (priceListDeleted > 0) {
          console.log(`   ℹ️  ${priceListDeleted} referencias en PriceListDetail eliminadas (constraint único)`);
        }

        // 2b. Migrar referencias de la nueva hacia la vieja (en otras tablas)
        const updatePromises = [
          SaleDetail.update(
            { presentation_id: keepPresentation.id },
            { where: { presentation_id: removePresentation.id } }
          ),
          PurchaseOrderDetail.update(
            { presentation_id: keepPresentation.id },
            { where: { presentation_id: removePresentation.id } }
          ),
          CreditNoteDetail.update(
            { presentation_id: keepPresentation.id },
            { where: { presentation_id: removePresentation.id } }
          ),
          DeliveryDetail.update(
            { presentation_id: keepPresentation.id },
            { where: { presentation_id: removePresentation.id } }
          ),
          TransferDetail.update(
            { presentation_id: keepPresentation.id },
            { where: { presentation_id: removePresentation.id } }
          ),
          InventoryMovement.update(
            { presentation_id: keepPresentation.id },
            { where: { presentation_id: removePresentation.id } }
          )
        ];

        const migrationResults = await Promise.all(updatePromises);
        const totalMigrated = migrationResults.reduce((sum, result) => sum + result[0], 0);

        if (totalMigrated > 0) {
          console.log(`   ✅ ${totalMigrated} referencias migradas`);
        }

        // 3. Eliminar la presentación vieja
        await removePresentation.destroy();
        console.log(`   ✅ Eliminada presentación ID ${removePresentation.id}`);

        // 4. Asegurar que quede una con is_default=true
        if (!keepPresentation.is_default) {
          await keepPresentation.update({ is_default: true });
          console.log(`   ✅ Marcada como default: ID ${keepPresentation.id}`);
        }

        fusionadas++;

      } catch (err) {
        console.error(`   ❌ Error procesando producto "${product.name}" (ID ${product.id}):`, err.message);
        errores++;
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   ✅ Fusionadas: ${fusionadas}`);
    console.log(`   ❌ Errores: ${errores}\n`);

    console.log('✨ Fusión completada\n');

  } catch (error) {
    console.error('❌ Error general:', error);
    process.exit(1);
  }
}

mergeDuplicatePresentations()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
