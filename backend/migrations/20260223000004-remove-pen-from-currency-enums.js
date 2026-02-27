'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Update any existing PEN rows to USD before altering ENUM
    await queryInterface.sequelize.query(
      "UPDATE price_lists SET currency = 'USD' WHERE currency = 'PEN'"
    );
    await queryInterface.sequelize.query(
      "UPDATE quotes SET currency = 'USD' WHERE currency = 'PEN'"
    );

    // 2. Alter ENUM columns to remove PEN
    await queryInterface.sequelize.query(
      "ALTER TABLE price_lists MODIFY COLUMN currency ENUM('USD', 'COP', 'VES') NOT NULL DEFAULT 'USD'"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE quotes MODIFY COLUMN currency ENUM('USD', 'COP', 'VES') NOT NULL DEFAULT 'USD'"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE exchange_rates MODIFY COLUMN from_currency ENUM('USD', 'COP', 'VES') NOT NULL"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE exchange_rates MODIFY COLUMN to_currency ENUM('USD', 'COP', 'VES') NOT NULL"
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Restore PEN to all ENUM columns
    await queryInterface.sequelize.query(
      "ALTER TABLE price_lists MODIFY COLUMN currency ENUM('USD', 'COP', 'VES', 'PEN') NOT NULL DEFAULT 'USD'"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE quotes MODIFY COLUMN currency ENUM('USD', 'COP', 'VES', 'PEN') NOT NULL DEFAULT 'USD'"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE exchange_rates MODIFY COLUMN from_currency ENUM('USD', 'COP', 'VES', 'PEN') NOT NULL"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE exchange_rates MODIFY COLUMN to_currency ENUM('USD', 'COP', 'VES', 'PEN') NOT NULL"
    );
  }
};
