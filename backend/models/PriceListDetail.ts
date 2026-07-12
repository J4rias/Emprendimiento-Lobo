import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface PriceListDetailAttributes {
  id: number;
  price_list_id: number;
  product_id: number;
  presentation_id: number;
  package_cost: number;
  unit_cost: number;
  package_price: number;
  unit_price: number;
  margin_percentage: number;
  is_frozen: boolean;
  frozen_price: number | null;
  frozen_currency: string | null;
  package_price_usd: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PriceListDetailCreationAttributes extends Optional<
  PriceListDetailAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'package_cost' | 'unit_cost' | 'package_price' |
  'unit_price' | 'margin_percentage' | 'is_frozen' | 'frozen_currency' | 'package_price_usd'
> {}

const PriceListDetail = sequelize.define<Model<PriceListDetailAttributes, PriceListDetailCreationAttributes>>(
  'PriceListDetail',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    price_list_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'price_lists',
        key: 'id'
      },
      comment: 'Lista de precios a la que pertenece'
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id'
      }
    },
    presentation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'product_presentations',
        key: 'id'
      }
    },
    package_cost: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: false,
      defaultValue: 0,
      comment: 'Costo del paquete (snapshot del costo al momento de crear/actualizar)'
    },
    unit_cost: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: false,
      defaultValue: 0,
      comment: 'Costo unitario (package_cost / units_per_package)'
    },
    package_price: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: false,
      defaultValue: 0,
      comment: 'Precio de venta por paquete'
    },
    unit_price: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: false,
      defaultValue: 0,
      comment: 'Precio unitario (package_price / units_per_package)'
    },
    margin_percentage: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      defaultValue: 0,
      comment: 'Margen de ganancia con soporte a 4 decimales'
    },
    is_frozen: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si el precio está congelado (fijo)'
    },
    frozen_price: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: true,
      comment: 'Precio congelado'
    },
    frozen_currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
      defaultValue: 'USD',
      comment: 'Moneda en la que se congeló el precio'
    },
    package_price_usd: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: false,
      defaultValue: 0,
      comment: 'Precio de venta por paquete en USD directo (no depende de tasa)'
    }
  },
  {
    tableName: 'price_list_details',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['price_list_id']
      },
      {
        fields: ['product_id']
      },
      {
        fields: ['presentation_id']
      },
      {
        unique: true,
        fields: ['price_list_id', 'presentation_id'],
        name: 'unique_pricelist_presentation'
      }
    ]
  }
);

export = PriceListDetail;