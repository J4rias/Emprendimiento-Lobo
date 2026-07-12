import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// 1. Interfaz con TODOS los campos del modelo (los de la BD + timestamps)
interface TransferAttributes {
  id: number;
  transfer_number: string;
  origin_warehouse_id: number;
  destination_warehouse_id: number;
  transfer_date: Date;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  notes: string | null;
  requested_by: number;
  approved_by: number | null;
  shipped_by: number | null;
  received_by: number | null;
  approval_date: Date | null;
  ship_date: Date | null;
  received_date: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// 2. Atributos opcionales en creación: id + timestamps + campos con defaultValue
interface TransferCreationAttributes extends Optional<
  TransferAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'transfer_date' | 'status'
> {}

// 3. sequelize.define con los genéricos
const Transfer = sequelize.define<Model<TransferAttributes, TransferCreationAttributes>>(
  'Transfer',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    transfer_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    origin_warehouse_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'warehouses',
        key: 'id'
      }
    },
    destination_warehouse_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'warehouses',
        key: 'id'
      }
    },
    transfer_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_transit', 'completed', 'cancelled'),
      defaultValue: 'pending'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    requested_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    approved_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    shipped_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    received_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    approval_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    ship_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    received_date: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'transfers',
    timestamps: true
  }
);

// 5. export = en lugar de module.exports = (CJS compat con TypeScript)
export = Transfer;