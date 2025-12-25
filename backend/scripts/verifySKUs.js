const { Product, Brand, sequelize } = require('../models');

async function verifySKUs() {
  try {
    console.log('🔍 Verificando formato de SKUs...\n');

    const products = await Product.findAll({
      include: [{ model: Brand, as: 'brand' }],
      limit: 20,
      order: [['id', 'ASC']]
    });

    console.log('📋 Primeros 20 productos:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    products.forEach(p => {
      console.log(`ID: ${String(p.id).padStart(3, ' ')} | SKU: ${p.sku}`);
      console.log(`      Marca: ${p.brand?.name || 'N/A'}`);
      console.log(`      Producto: ${p.name.substring(0, 60)}\n`);
    });

    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifySKUs();
