'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add 'usdt' to sale_payments.payment_method ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE sale_payments
      MODIFY COLUMN payment_method ENUM('cash','card','transfer','check','other','credit_balance','usdt') NOT NULL
    `);

    // 2. Add 'usdt' to sales.payment_method ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE sales
      MODIFY COLUMN payment_method ENUM('cash','card','transfer','mixed','usdt') NULL
    `);

    // 3. Add 'usdt' to supplier_payments.payment_method ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE supplier_payments
      MODIFY COLUMN payment_method ENUM('cash','transfer','check','card','other','usdt') NOT NULL DEFAULT 'transfer'
    `);

    // 4. Create banks table (idempotent)
    const [tables] = await queryInterface.sequelize.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'banks'`
    );
    if (tables.length === 0) {
      await queryInterface.createTable('banks', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        currency: {
          type: Sequelize.ENUM('USD', 'COP', 'VES'),
          allowNull: false
        },
        type: {
          type: Sequelize.ENUM('bank', 'wallet', 'other'),
          allowNull: false,
          defaultValue: 'bank'
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        }
      });

      await queryInterface.bulkInsert('banks', [
        { name: 'Bancolombia', currency: 'COP', type: 'bank', created_at: new Date(), updated_at: new Date() },
        { name: 'BDV', currency: 'VES', type: 'bank', created_at: new Date(), updated_at: new Date() },
        { name: 'Banesco', currency: 'VES', type: 'bank', created_at: new Date(), updated_at: new Date() },
      ]);
    }

    // 5. Add bank_id column if missing
    const [cols] = await queryInterface.sequelize.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sale_payments' AND COLUMN_NAME = 'bank_id'`
    );
    if (cols.length === 0) {
      await queryInterface.addColumn('sale_payments', 'bank_id', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }

    const [cols2] = await queryInterface.sequelize.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplier_payments' AND COLUMN_NAME = 'bank_id'`
    );
    if (cols2.length === 0) {
      await queryInterface.addColumn('supplier_payments', 'bank_id', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }

    // 6. Add FK constraints (idempotent)
    const [fks] = await queryInterface.sequelize.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sale_payments' AND CONSTRAINT_NAME = 'fk_sale_payments_bank_id'`
    );
    if (fks.length === 0) {
      await queryInterface.addConstraint('sale_payments', {
        fields: ['bank_id'],
        type: 'foreign key',
        name: 'fk_sale_payments_bank_id',
        references: { table: 'banks', field: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
    }

    const [fks2] = await queryInterface.sequelize.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplier_payments' AND CONSTRAINT_NAME = 'fk_supplier_payments_bank_id'`
    );
    if (fks2.length === 0) {
      await queryInterface.addConstraint('supplier_payments', {
        fields: ['bank_id'],
        type: 'foreign key',
        name: 'fk_supplier_payments_bank_id',
        references: { table: 'banks', field: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('sale_payments', 'fk_sale_payments_bank_id').catch(() => {});
    await queryInterface.removeConstraint('supplier_payments', 'fk_supplier_payments_bank_id').catch(() => {});
    await queryInterface.dropTable('banks').catch(() => {});

    await queryInterface.sequelize.query(`
      ALTER TABLE sale_payments
      MODIFY COLUMN payment_method ENUM('cash','card','transfer','check','other','credit_balance') NOT NULL
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE sales
      MODIFY COLUMN payment_method ENUM('cash','card','transfer','mixed') NULL
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE supplier_payments
      MODIFY COLUMN payment_method ENUM('cash','transfer','check','card','other') NOT NULL DEFAULT 'transfer'
    `);
  }
};
