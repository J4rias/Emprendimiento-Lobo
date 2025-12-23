require('dotenv').config();
const { sequelize } = require('../config/database');
const { Product, Category } = require('../models');

async function checkProducts() {
  try {
    await sequelize.authenticate();

    // Contar productos
    const productCount = await Product.count();
    console.log(`\n=== PRODUCTOS IMPORTADOS ===`);
    console.log(`Total de productos: ${productCount}\n`);

    // Obtener productos con categorías
    const products = await Product.findAll({
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name']
        }
      ],
      limit: 10,
      order: [['created_at', 'DESC']]
    });

    console.log('Últimos 10 productos creados:\n');
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   SKU: ${product.sku}`);
      console.log(`   Marca: ${product.brand || 'N/A'}`);
      console.log(`   Categoría: ${product.category?.name || 'N/A'}`);
      console.log(`   Unidad: ${product.unit_of_measure}`);
      console.log('');
    });

    // Productos por categoría
    const productsByCategory = await Product.findAll({
      attributes: [
        'category_id',
        [sequelize.fn('COUNT', sequelize.col('Product.id')), 'count']
      ],
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['name']
        }
      ],
      group: ['category_id', 'category.id', 'category.name']
    });

    console.log('Productos por categoría:');
    productsByCategory.forEach(item => {
      console.log(`  - ${item.category?.name || 'Sin categoría'}: ${item.get('count')} productos`);
    });

    console.log('\n');

    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkProducts();
