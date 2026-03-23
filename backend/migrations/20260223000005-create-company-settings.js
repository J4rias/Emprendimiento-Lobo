'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if table already exists
    const tableExists = await queryInterface.tableExists('company_settings');
    if (tableExists) return;

    await queryInterface.sequelize.query(`
      CREATE TABLE company_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(150) NOT NULL DEFAULT 'Mi Empresa',
        address VARCHAR(255),
        phone VARCHAR(50),
        email VARCHAR(100),
        tax_id VARCHAR(50),
        website VARCHAR(150),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Insert default row
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
