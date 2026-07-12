import { DataTypes, Model, Optional, Op } from 'sequelize';
import { sequelize } from '../config/database';

interface PreOrderAttributes {
  id: number;
  code: string;
  customer_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  channel: 'messenger' | 'telegram' | 'web';
  status: 'pending' | 'approved' | 'rejected' | 'converted' | 'expired';
  notes: string | null;
  subtotal: number;
  total: number;
  currency: string;
  exchange_rate: number | null;
  converted_sale_id: number | null;
  approved_by: number | null;
  approved_at: Date | null;
  expires_at: Date | null;
  created_by: number | null;
  warehouse_id: number;
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
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    customer_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    customer_phone: {
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
    exchange_rate: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: true
    },
    converted_sale_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    approved_by: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    warehouse_id: {
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
        if (!preOrder.expires_at) {
          const expires = new Date();
          expires.setHours(expires.getHours() + 24);
          preOrder.expires_at = expires;
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
