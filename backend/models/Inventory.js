const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Inventory = sequelize.define('Inventory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    }
  },
  warehouse_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'warehouses',
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  reserved_quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Cantidad reservada en órdenes pendientes'
  },
  available_quantity: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.quantity - this.reserved_quantity;
    }
  },
  last_count_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_movement_date: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'inventory',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['product_id', 'warehouse_id']
    }
  ]
});

module.exports = Inventory;
