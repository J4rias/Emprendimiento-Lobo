import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface BarcodeAttributes {
  id: number;
  product_id: number;
  presentation_id: number | null;
  barcode: string;
  type: string;
  is_primary: boolean;
  is_active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface BarcodeCreationAttributes extends Optional<
  BarcodeAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'presentation_id' | 'type' | 'is_primary' | 'is_active'
> {}

const Barcode = sequelize.define<Model<BarcodeAttributes, BarcodeCreationAttributes>>('Barcode', {
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
  presentation_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'product_presentations',
      key: 'id'
    }
  },
  barcode: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'EAN13',
    comment: 'EAN13, EAN8, UPC, CODE128, etc.'
  },
  is_primary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'barcodes',
  timestamps: true
});

export = Barcode;