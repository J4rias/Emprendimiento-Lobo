import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface ProductAttributes {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  category_id: number;
  brand_id: number | null;
  is_perishable: boolean;
  has_batch_control: boolean;
  min_stock: number;
  max_stock: number;
  reorder_point: number;
  image_url: string | null;
  unit_size: number | null;
  unit_size_measure: string | null;
  is_active: boolean;
  created_by: number;
  updated_by: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ProductCreationAttributes extends Optional<
  ProductAttributes,
  'id' | 'brand_id' | 'is_perishable' | 'has_batch_control' | 'min_stock' | 'max_stock' | 'reorder_point' | 'image_url' | 'unit_size' | 'unit_size_measure' | 'is_active' | 'updated_by' | 'createdAt' | 'updatedAt'
> {}

const Product = sequelize.define<Model<ProductAttributes, ProductCreationAttributes>>(
  'Product',
  {
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
    brand_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'brands',
        key: 'id'
      }
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
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    max_stock: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    reorder_point: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    image_url: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    unit_size: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Tamaño de la unidad individual (ej: 500 para 500ml)'
    },
    unit_size_measure: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'UND',
      comment: 'Medida del tamaño (UND, LT, ML, KG, GR, OZ, etc.)'
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
  },
  {
    tableName: 'products',
    timestamps: true
  }
);

export = Product;