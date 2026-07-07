import { DataTypes, Model, Optional, Op } from 'sequelize';
import { sequelize } from '../config/database';

// 1. Interfaz con TODOS los campos del modelo (los de la BD + timestamps)
interface PriceListAttributes {
  id: number;
  code: string;
  name: string;
  description: string | null;
  currency: 'USD' | 'COP' | 'VES';
  base_percentage: number;
  is_default: boolean;
  status: 'active' | 'inactive';
  validity_days: number;
  valid_from: Date | null;
  valid_until: Date | null;
  updated_by: number | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

// 2. Atributos opcionales en creación: id + timestamps + campos con defaultValue
interface PriceListCreationAttributes extends Optional<
  PriceListAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'currency' | 'base_percentage' | 'is_default' | 'status' | 'validity_days'
> {}

// 3. sequelize.define con los genéricos
const PriceList = sequelize.define<Model<PriceListAttributes, PriceListCreationAttributes>>(
  'PriceList',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    code: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: false,
      comment: 'Código único de la lista de precios'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Nombre de la lista de precios'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    currency: {
      type: DataTypes.ENUM('USD', 'COP', 'VES'),
      allowNull: false,
      defaultValue: 'USD',
      comment: 'Moneda de la lista de precios'
    },
    base_percentage: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      defaultValue: 0,
      comment: 'Porcentaje base de ajuste sobre el costo (+/-)'
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si es la lista de precios por defecto'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      allowNull: false,
      defaultValue: 'active'
    },
    validity_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      comment: 'Vigencia en días a partir de valid_from'
    },
    valid_from: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de inicio de vigencia'
    },
    valid_until: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de fin de vigencia'
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      comment: 'Usuario que actualizó la lista por última vez'
    }
  },
  {
    tableName: 'price_lists',
    timestamps: true,
    underscored: true,
    paranoid: true,
    indexes: [
      {
        fields: ['code']
      },
      {
        fields: ['status']
      }
    ],
    hooks: {
      beforeValidate: async (priceList: any, options: any) => {
        // Generar código automático si no existe
        if (!priceList.code) {
          const lastPriceList = await PriceList.findOne({
            order: [['id', 'DESC']],
            paranoid: false,
            transaction: options.transaction
          }) as any;

          const nextNumber = lastPriceList ? lastPriceList.id + 1 : 1;
          priceList.code = `LP-${String(nextNumber).padStart(4, '0')}`;
        }
      },
      beforeSave: async (priceList: any, options: any) => {
        // Si se marca como default, desmarcar las demás
        if (priceList.is_default && priceList.changed('is_default')) {
          await PriceList.update(
            { is_default: false },
            {
              where: priceList.id ? {
                is_default: true,
                id: { [Op.ne]: priceList.id }
              } : {
                is_default: true
              },
              transaction: options.transaction
            }
          );
        }
        // Auto-calculate valid_until from valid_from + validity_days
        if (priceList.valid_from && priceList.validity_days) {
          const from = new Date(priceList.valid_from);
          from.setDate(from.getDate() + priceList.validity_days);
          priceList.valid_until = from;
        }
      }
    }
  }
);

// Método para verificar si está vigente
(PriceList as any).prototype.isValid = function () {
  const now = new Date();

  if (this.valid_from && now < this.valid_from) {
    return false;
  }

  if (this.valid_until && now > this.valid_until) {
    return false;
  }

  return this.status === 'active';
};

// Personalizar JSON
(PriceList as any).prototype.toJSON = function () {
  const values = { ...this.get() };
  return values;
};

export = PriceList;
