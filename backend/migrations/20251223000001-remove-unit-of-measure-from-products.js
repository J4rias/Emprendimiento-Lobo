'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove unit_of_measure column from products table
    await queryInterface.removeColumn('products', 'unit_of_measure');
  },

  async down(queryInterface, Sequelize) {
    // Add back unit_of_measure column if we need to rollback
    await queryInterface.addColumn('products', 'unit_of_measure', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'UND',
      comment: 'UND, KG, LT, MT, etc.'
    });
  }
};
