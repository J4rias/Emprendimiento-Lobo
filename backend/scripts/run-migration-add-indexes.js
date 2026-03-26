const { sequelize } = require('../config/database');

/**
 * Add database indexes for performance optimization
 * Called during database initialization to ensure optimal query performance
 */
const addIndexes = async () => {
  try {
    console.log('📊 Adding database indexes...\n');

    const indexes = [
      // Ventas
      {
        name: 'idx_sales_customer_type',
        sql: 'CREATE INDEX IF NOT EXISTS idx_sales_customer_type ON sales(customer_id, sale_type)'
      },
      {
        name: 'idx_sales_date_status',
        sql: 'CREATE INDEX IF NOT EXISTS idx_sales_date_status ON sales(sale_date, status)'
      },
      {
        name: 'idx_sale_payments_sale',
        sql: 'CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id)'
      },

      // Inventario
      {
        name: 'idx_inventory_product_warehouse',
        sql: 'CREATE INDEX IF NOT EXISTS idx_inventory_product_warehouse ON inventory(product_id, warehouse_id)'
      },

      // Productos
      {
        name: 'idx_products_category',
        sql: 'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)'
      },
      {
        name: 'idx_products_active',
        sql: 'CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)'
      },
      {
        name: 'idx_barcodes_barcode',
        sql: 'CREATE INDEX IF NOT EXISTS idx_barcodes_barcode ON barcodes(barcode)'
      },
      {
        name: 'idx_presentations_product',
        sql: 'CREATE INDEX IF NOT EXISTS idx_presentations_product ON product_presentations(product_id)'
      },

      // Clientes
      {
        name: 'idx_customers_code',
        sql: 'CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(code)'
      },

      // Price lists
      {
        name: 'idx_price_list_details_list',
        sql: 'CREATE INDEX IF NOT EXISTS idx_price_list_details_list ON price_list_details(price_list_id)'
      },
      {
        name: 'idx_price_list_details_presentation',
        sql: 'CREATE INDEX IF NOT EXISTS idx_price_list_details_presentation ON price_list_details(presentation_id)'
      }
    ];

    let createdCount = 0;
    for (const index of indexes) {
      try {
        await sequelize.query(index.sql);
        console.log(`  ✅ ${index.name}`);
        createdCount++;
      } catch (error) {
        // Index might already exist, which is fine
        if (error.message.includes('already exists')) {
          console.log(`  ⏭️  ${index.name} (already exists)`);
        } else {
          console.log(`  ⚠️  ${index.name} - ${error.message}`);
        }
      }
    }

    console.log(`\n✅ Database indexes initialized (${createdCount}/${indexes.length} created/verified)\n`);
    return true;
  } catch (error) {
    console.error('❌ Error adding indexes:', error.message);
    throw error;
  }
};

// Run if called directly
if (require.main === module) {
  addIndexes()
    .then(() => {
      console.log('Index migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Index migration failed:', error);
      process.exit(1);
    });
}

module.exports = addIndexes;
