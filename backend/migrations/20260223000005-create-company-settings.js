'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('company_settings', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
        defaultValue: 'Mi Empresa',
      },
      address: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      phone: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      tax_id: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      website: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    // Insertar fila default
    await queryInterface.bulkInsert('company_settings', [{
      id: 1,
      name: 'Mi Empresa',
      address: null,
      phone: null,
      email: null,
      tax_id: null,
      website: null,
      created_at: new Date(),
      updated_at: new Date(),
    }]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('company_settings');
  },
};
