'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // MySQL ENUM modification requires a full column change
    await queryInterface.sequelize.query(
      "ALTER TABLE sales MODIFY COLUMN status ENUM('pending', 'completed', 'cancelled', 'returned', 'delivered') NOT NULL DEFAULT 'pending'"
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE sales MODIFY COLUMN status ENUM('pending', 'completed', 'cancelled', 'returned') NOT NULL DEFAULT 'pending'"
    );
  }
};
