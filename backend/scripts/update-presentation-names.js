const { Product, ProductPresentation, PackagingType } = require('../models');

/**
 * Script para actualizar los nombres de las presentaciones existentes
 * Formato: {unit_size} {unit_size_measure} {packaging_abbr} x{units_per_package}
 */

async function updatePresentationNames() {
  try {
    console.log('🔄 Iniciando actualización de nombres de presentaciones...\n');

    // Obtener todos los productos con sus presentaciones
    const products = await Product.findAll({
      include: [
        {
          model: ProductPresentation,
          as: 'presentations',
          include: [
            { model: PackagingType, as: 'packagingType' }
          ]
        }
      ]
    });

    console.log(`📦 Encontrados ${products.length} productos\n`);

    let updatedPresentations = 0;
    let skippedPresentations = 0;
    let errors = 0;

    for (const product of products) {
      if (!product.presentations || product.presentations.length === 0) {
        console.log(`⏭️  Sin presentaciones: ${product.name}\n`);
        continue;
      }

      for (const presentation of product.presentations) {
        try {
          const oldName = presentation.name;

          // Generar nuevo nombre
          const unitSize = parseFloat(product.unit_size);
          const formattedUnitSize = unitSize % 1 === 0 ? unitSize.toString() : unitSize.toFixed(1);
          const unitMeasure = product.unit_size_measure || 'UND';
          const packagingAbbr = presentation.packagingType
            ? presentation.packagingType.name.substring(0, 3).toUpperCase()
            : 'EMP';
          const unitsPerPackage = presentation.units_per_package;

          const newName = `${formattedUnitSize} ${unitMeasure} ${packagingAbbr} x${unitsPerPackage}`;

          if (oldName !== newName) {
            await presentation.update({ name: newName });
            console.log(`✅ Actualizada presentación:`);
            console.log(`   Producto: ${product.name}`);
            console.log(`   Antiguo:  ${oldName}`);
            console.log(`   Nuevo:    ${newName}\n`);
            updatedPresentations++;
          } else {
            console.log(`⏭️  Sin cambios: ${product.name} - ${oldName}\n`);
            skippedPresentations++;
          }
        } catch (error) {
          console.error(`❌ Error actualizando presentación ${presentation.id} del producto ${product.name}:`, error.message);
          errors++;
        }
      }
    }

    console.log('\n📊 Resumen:');
    console.log(`   ✅ Presentaciones actualizadas: ${updatedPresentations}`);
    console.log(`   ⏭️  Sin cambios: ${skippedPresentations}`);
    console.log(`   ❌ Errores: ${errors}\n`);

    console.log('✨ Actualización completada\n');
  } catch (error) {
    console.error('❌ Error general:', error);
    process.exit(1);
  }
}

// Ejecutar el script
updatePresentationNames()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
