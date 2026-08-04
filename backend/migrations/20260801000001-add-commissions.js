'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Comisión por presentación (COP) — paquete y unidad suelta
    const presTable = await queryInterface.describeTable('product_presentations');
    if (!presTable.package_commission) {
      await queryInterface.addColumn('product_presentations', 'package_commission', {
        type: Sequelize.DECIMAL(18, 6),
        allowNull: false,
        defaultValue: 0,
        comment: 'Comisión fija por paquete (COP)'
      });
    }
    if (!presTable.unit_commission) {
      await queryInterface.addColumn('product_presentations', 'unit_commission', {
        type: Sequelize.DECIMAL(18, 6),
        allowNull: false,
        defaultValue: 0,
        comment: 'Comisión fija por unidad suelta (COP)'
      });
    }

    // 2. Comisión por línea de venta (COP) — congelada al momento de la venta
    const detailTable = await queryInterface.describeTable('sale_details');
    if (!detailTable.commission_amount) {
      await queryInterface.addColumn('sale_details', 'commission_amount', {
        type: Sequelize.DECIMAL(18, 6),
        allowNull: false,
        defaultValue: 0,
        comment: 'Comisión de la línea en COP (congelada al vender)'
      });
    }

    // 3. Comisión total de la venta (COP) — para reportes rápidos
    const saleTable = await queryInterface.describeTable('sales');
    if (!saleTable.total_commission) {
      await queryInterface.addColumn('sales', 'total_commission', {
        type: Sequelize.DECIMAL(18, 6),
        allowNull: false,
        defaultValue: 0,
        comment: 'Comisión total de la venta (COP)'
      });
    }

    // 4. Permiso commissions.view + asignación a roles admin (mismo patrón que sales.collect)
    const [existingPerm] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE name = 'commissions.view' LIMIT 1"
    );
    if (existingPerm.length === 0) {
      await queryInterface.sequelize.query(
        `INSERT INTO permissions (name, description, module, action, created_at, updated_at)
         VALUES ('commissions.view', 'Ver reporte de comisiones por vendedor', 'commissions', 'view', NOW(), NOW())`
      );
    }

    const [commissionsPerm] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE name = 'commissions.view' LIMIT 1"
    );
    if (commissionsPerm.length > 0) {
      const permId = commissionsPerm[0].id;
      const [adminRoles] = await queryInterface.sequelize.query(
        `SELECT DISTINCT rp.role_id FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         WHERE p.name = 'settings.manage'`
      );
      for (const row of adminRoles) {
        const [already] = await queryInterface.sequelize.query(
          `SELECT id FROM role_permissions WHERE role_id = ${row.role_id} AND permission_id = ${permId} LIMIT 1`
        );
        if (already.length === 0) {
          await queryInterface.sequelize.query(
            `INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
             VALUES (${row.role_id}, ${permId}, NOW(), NOW())`
          );
        }
      }
    }
  },

  down: async (queryInterface) => {
    const saleTable = await queryInterface.describeTable('sales');
    if (saleTable.total_commission) {
      await queryInterface.removeColumn('sales', 'total_commission');
    }
    const detailTable = await queryInterface.describeTable('sale_details');
    if (detailTable.commission_amount) {
      await queryInterface.removeColumn('sale_details', 'commission_amount');
    }
    const presTable = await queryInterface.describeTable('product_presentations');
    if (presTable.unit_commission) {
      await queryInterface.removeColumn('product_presentations', 'unit_commission');
    }
    if (presTable.package_commission) {
      await queryInterface.removeColumn('product_presentations', 'package_commission');
    }

    const [perm] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE name = 'commissions.view' LIMIT 1"
    );
    if (perm.length > 0) {
      await queryInterface.sequelize.query(
        `DELETE FROM role_permissions WHERE permission_id = ${perm[0].id}`
      );
      await queryInterface.sequelize.query(
        `DELETE FROM permissions WHERE id = ${perm[0].id}`
      );
    }
  }
};
