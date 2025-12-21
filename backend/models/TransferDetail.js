const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TransferDetail = sequelize.define('TransferDetail', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  transfer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'transfers',
      key: 'id'
    }
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    }
  },
  batch_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'batches',
      key: 'id'
    }
  },
  quantity_requested: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  quantity_shipped: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  quantity_received: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'transfer_details',
  timestamps: true
});

module.exports = TransferDetail;
