'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('categories', 'color', {
      type: Sequelize.STRING(7),
      allowNull: true,
      defaultValue: '#6B7280',
      after: 'description'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('categories', 'color');
  }
};
