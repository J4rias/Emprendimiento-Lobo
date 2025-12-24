'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add purchase_currency to product_presentations
    await queryInterface.addColumn('product_presentations', 'purchase_currency', {
      type: Sequelize.ENUM('USD', 'COP', 'VES'),
      allowNull: false,
      defaultValue: 'USD',
      comment: 'Moneda en la que se compró el producto'
    });

    // Note: image_url already exists in products table from the original schema
    // If it doesn't exist, we can add it here
    const tableDescription = await queryInterface.describeTable('products');
    
    if (!tableDescription.image_url) {
      await queryInterface.addColumn('products', 'image_url', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'URL de la imagen del producto'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('product_presentations', 'purchase_currency');
    // Don't remove image_url as it might be from original schema
  }
};
