'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Índice compuesto para queries de inventory_movements por tipo + fecha.
      // Antes: MySQL usaba movement_type solo (ref, 47% filtered, Using temporary).
      // Con este índice: range scan directo, elimina full-filter y Using temporary.
      await queryInterface.addIndex(
        'inventory_movements',
        ['movement_type', 'created_at'],
        {
          name: 'idx_inv_movements_type_date',
          transaction,
        }
      );

      await transaction.commit();
      console.log('✓ Índice idx_inv_movements_type_date agregado a inventory_movements');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeIndex('inventory_movements', 'idx_inv_movements_type_date', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
