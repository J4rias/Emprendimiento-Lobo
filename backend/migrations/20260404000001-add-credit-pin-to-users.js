'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('users');

    if (!table.credit_pin) {
      await queryInterface.addColumn('users', 'credit_pin', {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
        comment: 'PIN hasheado para autorizar créditos',
        after: 'last_login'
      });
    }
    if (!table.credit_pin_attempts) {
      await queryInterface.addColumn('users', 'credit_pin_attempts', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Intentos fallidos de PIN de crédito',
        after: 'credit_pin'
      });
    }
    if (!table.credit_pin_locked_until) {
      await queryInterface.addColumn('users', 'credit_pin_locked_until', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
        comment: 'Fecha hasta la que está bloqueado el PIN por intentos fallidos',
        after: 'credit_pin_attempts'
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'credit_pin_locked_until');
    await queryInterface.removeColumn('users', 'credit_pin_attempts');
    await queryInterface.removeColumn('users', 'credit_pin');
  }
};
