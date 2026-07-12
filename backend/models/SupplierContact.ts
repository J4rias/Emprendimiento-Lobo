import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// 1. Interfaz con TODOS los campos del modelo (los de la BD + timestamps)
interface SupplierContactAttributes {
  id: number;
  supplier_id: number;
  name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  is_primary: boolean;
  notes: string | null;
  is_active: boolean;
  created_by: number;
  updated_by: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// 2. Atributos opcionales en creación: id + timestamps + campos con defaultValue
interface SupplierContactCreationAttributes extends Optional<
  SupplierContactAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'is_primary' | 'is_active'
> {}

// 3. sequelize.define con los genéricos
const SupplierContact = sequelize.define<Model<SupplierContactAttributes, SupplierContactCreationAttributes>>(
  'SupplierContact',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    supplier_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'suppliers',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: 'Nombre completo del contacto'
    },
    position: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Cargo del contacto'
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmailOrEmpty(value: any) {
          if (value && value.trim() !== '') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
              throw new Error('Debe ser un email válido');
            }
          }
        }
      }
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    mobile: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Indica si es el contacto principal'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales del contacto'
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
    tableName: 'supplier_contacts',
    timestamps: true,
    indexes: [
      {
        unique: false,
        fields: ['supplier_id']
      },
      {
        unique: false,
        fields: ['supplier_id', 'is_primary']
      }
    ]
  }
);

// Asociaciones
(SupplierContact as any).associate = (models: any) => {
  SupplierContact.belongsTo(models.Supplier, {
    foreignKey: 'supplier_id',
    as: 'supplier'
  });
};

export = SupplierContact;
