'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Eliminar campos no usados de la tabla suppliers solo si existen
    const tableDescription = await queryInterface.describeTable('suppliers');

    const columnsToRemove = ['contact_person', 'email', 'phone', 'mobile', 'address', 'city', 'state', 'country'];

    for (const column of columnsToRemove) {
      if (tableDescription[column]) {
        await queryInterface.removeColumn('suppliers', column);
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Restaurar campos en caso de rollback
    await queryInterface.addColumn('suppliers', 'contact_person', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    await queryInterface.addColumn('suppliers', 'email', {
      type: Sequelize.STRING(100),
      allowNull: true,
      validate: {
        isEmail: true
      }
    });
    await queryInterface.addColumn('suppliers', 'phone', {
      type: Sequelize.STRING(20),
      allowNull: true
    });
    await queryInterface.addColumn('suppliers', 'mobile', {
      type: Sequelize.STRING(20),
      allowNull: true
    });
    await queryInterface.addColumn('suppliers', 'address', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('suppliers', 'city', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    await queryInterface.addColumn('suppliers', 'state', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
    await queryInterface.addColumn('suppliers', 'country', {
      type: Sequelize.STRING(100),
      allowNull: true,
      defaultValue: 'Venezuela'
    });
  }
};
