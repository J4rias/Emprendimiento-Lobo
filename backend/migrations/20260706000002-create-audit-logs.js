'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      table_name: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      record_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      action: {
        type: Sequelize.ENUM('CREATE', 'UPDATE', 'DELETE', 'CANCEL'),
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      ip: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      old_values: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      new_values: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('audit_logs', ['table_name', 'record_id'], { name: 'idx_audit_table_record' });
    await queryInterface.addIndex('audit_logs', ['user_id'], { name: 'idx_audit_user_id' });
    await queryInterface.addIndex('audit_logs', ['created_at'], { name: 'idx_audit_created_at' });
    await queryInterface.addIndex('audit_logs', ['action'], { name: 'idx_audit_action' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
  },
};
