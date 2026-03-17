const { Op } = require('sequelize');
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

/**
 * Script de limpieza de presentaciones auto-generadas.
 *
 * Pasada 1: Elimina presentaciones auto-generadas con nombre "* - Presentación estándar"
 *   - Solo elimina si no tienen referencias en tablas transaccionales.
 *   - Nulifica las referencias en TransferDetail e InventoryMovement antes de eliminar.
 *
 * Pasada 2: Garantiza que cada producto tenga exactamente una presentación por defecto.
 *   - Si un producto tiene presentaciones pero ninguna con is_default=true, marca la primera.
 */

async function fixAutoPresentations() {
  try {
    console.log('🔧 Iniciando limpieza de presentaciones auto-generadas...\n');

    // ─────────────────────────────────────────────────
    // PASADA 1: Eliminar presentaciones auto-generadas
    // ─────────────────────────────────────────────────
    console.log('📋 PASADA 1: Buscando presentaciones auto-generadas...\n');

    const autoPresentation = await ProductPresentation.findAll({
      where: {
        name: { [Op.like]: '% - Presentación estándar' }
      },
      include: [{ model: Product, as: 'product' }],
      order: [['id', 'ASC']]
    });

    console.log(`   Encontradas: ${autoPresentation.length} presentaciones candidatas\n`);

    let eliminadas = 0;
    let noEliminables = 0;
    let errores = 0;

    for (const pres of autoPresentation) {
      const pid = pres.id;
      const productName = pres.product ? pres.product.name : `producto_id=${pres.product_id}`;

      try {
        // Verificar referencias en tablas transaccionales
        const [salesCount, poCount, priceListCount, creditNoteCount, deliveryCount] = await Promise.all([
          SaleDetail.count({ where: { presentation_id: pid } }),
          PurchaseOrderDetail.count({ where: { presentation_id: pid } }),
          PriceListDetail.count({ where: { presentation_id: pid } }),
          CreditNoteDetail.count({ where: { presentation_id: pid } }),
          DeliveryDetail.count({ where: { presentation_id: pid } })
        ]);

        const totalRefs = salesCount + poCount + priceListCount + creditNoteCount + deliveryCount;

        if (totalRefs > 0) {
          console.log(`⚠️  NO ELIMINABLE — Presentación ID ${pid} del producto "${productName}"`);
          console.log(`   Referencias: ventas=${salesCount}, OC=${poCount}, precios=${priceListCount}, NC=${creditNoteCount}, entregas=${deliveryCount}\n`);
          noEliminables++;
          continue;
        }

        // Nulificar referencias en tablas que lo permiten (nullable)
        const [transfersUpdated, movementsUpdated] = await Promise.all([
          TransferDetail.update({ presentation_id: null }, { where: { presentation_id: pid } }),
          InventoryMovement.update({ presentation_id: null }, { where: { presentation_id: pid } })
        ]);

        await pres.destroy();

        console.log(`✅ Eliminada — Presentación ID ${pid} del producto "${productName}"`);
        if (transfersUpdated[0] > 0) console.log(`   Nulificadas ${transfersUpdated[0]} referencias en TransferDetail`);
        if (movementsUpdated[0] > 0) console.log(`   Nulificadas ${movementsUpdated[0]} referencias en InventoryMovement`);
        console.log('');

        eliminadas++;
      } catch (err) {
        console.error(`❌ Error procesando presentación ID ${pid} del producto "${productName}":`, err.message, '\n');
        errores++;
      }
    }

    console.log('📊 Resumen Pasada 1:');
    console.log(`   ✅ Eliminadas: ${eliminadas}`);
    console.log(`   ⚠️  No eliminables (tienen referencias): ${noEliminables}`);
    console.log(`   ❌ Errores: ${errores}\n`);

    // ─────────────────────────────────────────────────
    // PASADA 2: Garantizar default en todos los productos
    // ─────────────────────────────────────────────────
    console.log('📋 PASADA 2: Verificando presentaciones por defecto...\n');

    const products = await Product.findAll({
      include: [{
        model: ProductPresentation,
        as: 'presentations',
        where: { is_active: true },
        required: false
      }]
    });

    let defaultsAsignados = 0;
    let productsSinPresentaciones = 0;

    for (const product of products) {
      const presentations = product.presentations || [];

      if (presentations.length === 0) {
        productsSinPresentaciones++;
        continue;
      }

      const hasDefault = presentations.some(p => p.is_default);
      if (!hasDefault) {
        // Marcar la presentación con ID más bajo como default
        const first = presentations.sort((a, b) => a.id - b.id)[0];
        await first.update({ is_default: true });
        console.log(`✅ Default asignado — Producto "${product.name}" → Presentación ID ${first.id} ("${first.name}")`);
        defaultsAsignados++;
      }
    }

    console.log(`\n📊 Resumen Pasada 2:`);
    console.log(`   ✅ Defaults asignados: ${defaultsAsignados}`);
    console.log(`   ⏭️  Sin presentaciones activas: ${productsSinPresentaciones}\n`);

    console.log('✨ Limpieza completada\n');

  } catch (error) {
    console.error('❌ Error general:', error);
    process.exit(1);
  }
}

fixAutoPresentations()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
