import { DataTypes, Model, Optional, Op } from 'sequelize';
import { sequelize } from '../config/database';

interface PreOrderAttributes {
  id: number;
  code: string;
  customerId: number | null;
  customerName: string | null;
  customerPhone: string | null;
  channel: 'messenger' | 'telegram' | 'web';
  status: 'pending' | 'approved' | 'rejected' | 'converted' | 'expired';
  notes: string | null;
  subtotal: number;
  total: number;
  currency: string;
  exchangeRate: number | null;
  convertedSaleId: number | null;
  approvedBy: number | null;
  approvedAt: Date | null;
  expiresAt: Date | null;
  createdBy: number | null;
  warehouseId: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

interface PreOrderCreationAttributes extends Optional<
  PreOrderAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'channel' | 'status' | 'subtotal' | 'total' | 'currency'
> {}

const PreOrder = sequelize.define<Model<PreOrderAttributes, PreOrderCreationAttributes>>(
  'PreOrder',
  {
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
  },
  {
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
      beforeValidate: async (preOrder: any) => {
        if (!preOrder.code) {
          const year = new Date().getFullYear();
          const lastOrder = await PreOrder.findOne({
            where: {
              code: {
                [Op.like]: `PRE-${year}-%`
              }
            },
            order: [['id', 'DESC']],
            paranoid: false
          }) as any;

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
  }
);

(PreOrder.prototype as any).canBeApproved = function() {
  return this.status === 'pending';
};

(PreOrder.prototype as any).canBeConverted = function() {
  return this.status === 'approved';
};

export = PreOrder;