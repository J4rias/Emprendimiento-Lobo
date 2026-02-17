'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add unit_size and unit_size_measure to products table
    await queryInterface.addColumn('products', 'unit_size', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Tamaño de la unidad individual (ej: 500 para 500ml)'
    });

    await queryInterface.addColumn('products', 'unit_size_measure', {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: 'UND',
      comment: 'Medida del tamaño (UND, LT, ML, KG, GR, OZ, etc.)'
    });

    // 2. Migrate data from product_presentations to products
    // Copy unit_size from the default presentation to the product
    await queryInterface.sequelize.query(`
      UPDATE products p
      INNER JOIN product_presentations pp ON p.id = pp.product_id AND pp.is_default = 1
      SET
        p.unit_size = pp.unit_size,
        p.unit_size_measure = COALESCE(pp.unit_size_measure, 'UND')
      WHERE pp.unit_size IS NOT NULL
    `);

    // 3. Remove unit_size and unit_size_measure from product_presentations table
    await queryInterface.removeColumn('product_presentations', 'unit_size');
    await queryInterface.removeColumn('product_presentations', 'unit_size_measure');
  },

  down: async (queryInterface, Sequelize) => {
    // 1. Re-add unit_size and unit_size_measure to product_presentations
    await queryInterface.addColumn('product_presentations', 'unit_size', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Tamaño de la unidad individual (ej: 2 para 2 litros)'
    });

    await queryInterface.addColumn('product_presentations', 'unit_size_measure', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'Medida del tamaño (LT, ML, KG, GR, etc.)'
    });

    // 2. Migrate data back from products to product_presentations
    await queryInterface.sequelize.query(`
      UPDATE product_presentations pp
      INNER JOIN products p ON pp.product_id = p.id
      SET
        pp.unit_size = p.unit_size,
        pp.unit_size_measure = p.unit_size_measure
      WHERE p.unit_size IS NOT NULL
    `);

    // 3. Remove from products table
    await queryInterface.removeColumn('products', 'unit_size');
    await queryInterface.removeColumn('products', 'unit_size_measure');
  }
};
