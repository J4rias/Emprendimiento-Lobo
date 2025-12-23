const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sku: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'categories',
      key: 'id'
    }
  },
  brand: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  manufacturer: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  unit_of_measure: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'UND',
    comment: 'UND, KG, LT, MT, etc.'
  },
  is_perishable: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  has_batch_control: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  min_stock: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  max_stock: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  reorder_point: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  image_url: {
    type: DataTypes.STRING(255),
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
  tableName: 'products',
  timestamps: true
});

module.exports = Product;
