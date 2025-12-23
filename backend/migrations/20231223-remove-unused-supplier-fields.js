'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Eliminar campos no usados de la tabla suppliers
    await queryInterface.removeColumn('suppliers', 'contact_person');
    await queryInterface.removeColumn('suppliers', 'email');
    await queryInterface.removeColumn('suppliers', 'phone');
    await queryInterface.removeColumn('suppliers', 'mobile');
    await queryInterface.removeColumn('suppliers', 'address');
    await queryInterface.removeColumn('suppliers', 'city');
    await queryInterface.removeColumn('suppliers', 'state');
    await queryInterface.removeColumn('suppliers', 'country');
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
