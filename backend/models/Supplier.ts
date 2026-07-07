import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// 1. Interfaz con TODOS los campos del modelo (los de la BD + timestamps)
interface SupplierAttributes {
  id: number;
  name: string;
  tax_id: string | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: number;
  updated_by: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// 2. Atributos opcionales en creación: id + timestamps + campos con defaultValue
interface SupplierCreationAttributes extends Optional<
  SupplierAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'is_active'
> {}

// 3. sequelize.define con los genéricos
const Supplier = sequelize.define<Model<SupplierAttributes, SupplierCreationAttributes>>(
  'Supplier',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    tax_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'RIF, Cédula, etc.'
    },
    payment_terms: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Ej: 30 días, 15 días, Contado'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
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
    tableName: 'suppliers',
    timestamps: true,
    paranoid: true
  }
);

// Asociaciones
(Supplier as any).associate = (models: any) => {
  Supplier.hasMany(models.SupplierContact, {
    foreignKey: 'supplier_id',
    as: 'contacts'
  });
};

export = Supplier;