'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Remove tax_rate column if it exists
    try {
      await queryInterface.removeColumn('products', 'tax_rate');
    } catch (error) {
      console.log('tax_rate column does not exist or already removed');
    }

    // 2. Change min_stock, max_stock, reorder_point to INTEGER
    await queryInterface.changeColumn('products', 'min_stock', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });

    await queryInterface.changeColumn('products', 'max_stock', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });

    await queryInterface.changeColumn('products', 'reorder_point', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });

    // 3. Add brand_id column if it doesn't exist
    const productTableDescription = await queryInterface.describeTable('products');

    if (!productTableDescription.brand_id) {
      await queryInterface.addColumn('products', 'brand_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'brands',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }

    // 4. Remove manufacturer column if it exists
    if (productTableDescription.manufacturer) {
      await queryInterface.removeColumn('products', 'manufacturer');
    }

    // 5. Remove old brand text column if it exists (will use brand_id instead)
    if (productTableDescription.brand) {
      await queryInterface.removeColumn('products', 'brand');
    }

    // 6. Create packaging_types table (bandeja, caja, fardo)
    await queryInterface.createTable('packaging_types', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Tipo de empaque: bandeja, caja, fardo, etc.'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // 7. Create presentation_types table (botella, bolsa, lata, caja)
    await queryInterface.createTable('presentation_types', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Tipo de presentación: botella, bolsa, lata, caja, etc.'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // 8. Update product_presentations table structure
    // First, check if columns exist before adding
    const tableDescription = await queryInterface.describeTable('product_presentations');

    if (!tableDescription.packaging_type_id) {
      await queryInterface.addColumn('product_presentations', 'packaging_type_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'packaging_types',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Tipo de empaque (bandeja, caja, fardo)'
      });
    }

    if (!tableDescription.presentation_type_id) {
      await queryInterface.addColumn('product_presentations', 'presentation_type_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'presentation_types',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Tipo de presentación (botella, bolsa, lata)'
      });
    }

    if (!tableDescription.units_per_package) {
      await queryInterface.addColumn('product_presentations', 'units_per_package', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Cantidad de unidades por empaque (ej: 6 botellas por bandeja)'
      });
    }

    if (!tableDescription.unit_size) {
      await queryInterface.addColumn('product_presentations', 'unit_size', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Tamaño de la unidad individual (ej: 2 para 2 litros)'
      });
    }

    if (!tableDescription.unit_size_measure) {
      await queryInterface.addColumn('product_presentations', 'unit_size_measure', {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Medida del tamaño (LT, ML, KG, GR, etc.)'
      });
    }

    if (!tableDescription.package_price) {
      await queryInterface.addColumn('product_presentations', 'package_price', {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true,
        comment: 'Precio del empaque completo (ej: $8 por bandeja)'
      });
    }

    if (!tableDescription.package_cost) {
      await queryInterface.addColumn('product_presentations', 'package_cost', {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true,
        comment: 'Costo del empaque completo'
      });
    }

    // Insert default packaging types if they don't exist
    try {
      await queryInterface.bulkInsert('packaging_types', [
        { name: 'Bandeja', description: 'Empaque en bandeja', is_active: true, created_at: new Date(), updated_at: new Date() },
        { name: 'Caja', description: 'Empaque en caja', is_active: true, created_at: new Date(), updated_at: new Date() },
        { name: 'Fardo', description: 'Empaque en fardo', is_active: true, created_at: new Date(), updated_at: new Date() },
        { name: 'Paquete', description: 'Empaque en paquete', is_active: true, created_at: new Date(), updated_at: new Date() },
        { name: 'Bulto', description: 'Empaque en bulto', is_active: true, created_at: new Date(), updated_at: new Date() },
        { name: 'Unidad', description: 'Venta por unidad individual', is_active: true, created_at: new Date(), updated_at: new Date() }
      ], { ignoreDuplicates: true });
    } catch (error) {
      console.log('Packaging types already exist or error inserting:', error.message);
    }

    // Insert default presentation types if they don't exist
    try {
      await queryInterface.bulkInsert('presentation_types', [
        { name: 'Botella', description: 'Envase en botella', is_active: true, created_at: new Date(), updated_at: new Date() },
        { name: 'Bolsa', description: 'Envase en bolsa', is_active: true, created_at: new Date(), updated_at: new Date() },
        { name: 'Lata', description: 'Envase en lata', is_active: true, created_at: new Date(), updated_at: new Date() },
        { name: 'Caja', description: 'Envase en caja', is_active: true, created_at: new Date(), updated_at: new Date() },
        { name: 'Envase Plástico', description: 'Envase de plástico', is_active: true, created_at: new Date(), updated_at: new Date() },
        { name: 'Vidrio', description: 'Envase de vidrio', is_active: true, created_at: new Date(), updated_at: new Date() },
        { name: 'Tetra Pak', description: 'Envase tetra pak', is_active: true, created_at: new Date(), updated_at: new Date() }
      ], { ignoreDuplicates: true });
    } catch (error) {
      console.log('Presentation types already exist or error inserting:', error.message);
    }
  },

  async down(queryInterface, Sequelize) {
    // Revert changes in reverse order

    // Remove columns from product_presentations
    await queryInterface.removeColumn('product_presentations', 'package_cost');
    await queryInterface.removeColumn('product_presentations', 'package_price');
    await queryInterface.removeColumn('product_presentations', 'unit_size_measure');
    await queryInterface.removeColumn('product_presentations', 'unit_size');
    await queryInterface.removeColumn('product_presentations', 'units_per_package');
    await queryInterface.removeColumn('product_presentations', 'presentation_type_id');
    await queryInterface.removeColumn('product_presentations', 'packaging_type_id');

    // Drop new tables
    await queryInterface.dropTable('presentation_types');
    await queryInterface.dropTable('packaging_types');

    // Add back brand and manufacturer columns
    await queryInterface.addColumn('products', 'brand', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await queryInterface.addColumn('products', 'manufacturer', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    // Remove brand_id column
    await queryInterface.removeColumn('products', 'brand_id');

    // Change back to DECIMAL
    await queryInterface.changeColumn('products', 'reorder_point', {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0
    });

    await queryInterface.changeColumn('products', 'max_stock', {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0
    });

    await queryInterface.changeColumn('products', 'min_stock', {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0
    });

    // Add back tax_rate
    await queryInterface.addColumn('products', 'tax_rate', {
      type: Sequelize.DECIMAL(5, 2),
      defaultValue: 0
    });
  }
};
