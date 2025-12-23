const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Supplier = sequelize.define('Supplier', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
    tax_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'RIF, Cédula, etc.'
  },
  payment_terms: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Ej: 30 días, 15 días, Contado'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'suppliers',
  timestamps: true
});

// Asociaciones
Supplier.associate = (models) => {
  Supplier.hasMany(models.SupplierContact, {
    foreignKey: 'supplier_id',
    as: 'contacts'
  });
};

module.exports = Supplier;
