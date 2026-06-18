const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PreOrderDetail = sequelize.define('PreOrderDetail', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  preOrderId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  presentationId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  isUnit: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  unitPrice: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false
  },
  total: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false
  },
  notes: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'pre_order_details',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeSave: (detail) => {
      detail.total = detail.quantity * detail.unitPrice;
    }
  }
});

module.exports = PreOrderDetail;
