const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PreOrder = sequelize.define('PreOrder', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: false
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  customerName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  customerPhone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  channel: {
    type: DataTypes.ENUM('messenger', 'telegram', 'web'),
    allowNull: false,
    defaultValue: 'messenger'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'converted', 'expired'),
    allowNull: false,
    defaultValue: 'pending'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  subtotal: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  },
  total: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'USD'
  },
  exchangeRate: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: true
  },
  convertedSaleId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  approvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  warehouseId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'pre_orders',
  timestamps: true,
  underscored: true,
  paranoid: true,
  indexes: [
    { fields: ['code'] },
    { fields: ['status'] },
    { fields: ['channel'] }
  ],
  hooks: {
    beforeValidate: async (preOrder) => {
      if (!preOrder.code) {
        const year = new Date().getFullYear();
        const lastOrder = await PreOrder.findOne({
          where: {
            code: {
              [sequelize.Sequelize.Op.like]: `PRE-${year}-%`
            }
          },
          order: [['id', 'DESC']],
          paranoid: false
        });

        let nextNumber = 1;
        if (lastOrder) {
          const lastNumber = parseInt(lastOrder.code.split('-')[2]);
          nextNumber = lastNumber + 1;
        }

        preOrder.code = `PRE-${year}-${String(nextNumber).padStart(5, '0')}`;
      }

      // Default expiration: 24 hours
      if (!preOrder.expiresAt) {
        const expires = new Date();
        expires.setHours(expires.getHours() + 24);
        preOrder.expiresAt = expires;
      }
    }
  }
});

PreOrder.prototype.canBeApproved = function() {
  return this.status === 'pending';
};

PreOrder.prototype.canBeConverted = function() {
  return this.status === 'approved';
};

module.exports = PreOrder;
