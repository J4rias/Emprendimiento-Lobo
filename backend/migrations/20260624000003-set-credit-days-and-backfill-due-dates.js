'use strict';

/**
 * Data migration:
 * 1. Set credit_days = 3 for all customers that have credit_days = 0
 *    (customers with existing non-zero credit_days are left unchanged)
 * 2. Backfill credit_due_date on all credit/mixed sales that don't have one,
 *    using the customer's credit_days (after step 1)
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });

      // 1. Set default credit_days = 3 for customers without it
      await q(`UPDATE customers SET credit_days = 3 WHERE credit_days = 0`);

      // 2. Backfill credit_due_date = sale_date + customer.credit_days
      //    for all credit/mixed sales missing it
      await q(`
        UPDATE sales s
        JOIN customers c ON c.id = s.customer_id
        SET s.credit_due_date = DATE_ADD(s.sale_date, INTERVAL c.credit_days DAY)
        WHERE s.sale_type IN ('credit', 'mixed')
          AND s.credit_amount > 0
          AND s.credit_due_date IS NULL
          AND c.credit_days > 0
      `);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });

      // Revert credit_due_date
      await q(`
        UPDATE sales SET credit_due_date = NULL
        WHERE sale_type IN ('credit', 'mixed') AND credit_due_date IS NOT NULL
      `);

      // Revert credit_days (only the ones we changed)
      await q(`UPDATE customers SET credit_days = 0 WHERE credit_days = 3`);
    });
  }
};
