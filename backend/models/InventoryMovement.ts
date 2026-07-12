import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface InventoryMovementAttributes {
  id: number;
  product_id: number;
  warehouse_id: number;
  presentation_id: number | null; // allowNull: true → T | null
  movement_type: 'ingreso' | 'egreso' | 'ajuste_positivo' | 'ajuste_negativo' | 'transferencia'; // ENUM → union de strings literales
  package_quantity: number | null; // DECIMAL(10,2) → number | null
  loose_units: number; // defaultValue: 0 → required in creation
  quantity: number;
  unit_cost: number | null; // allowNull: true → T | null
  package_cost: number | null; // allowNull: true → T | null
  currency: 'USD' | 'COP' | 'VES'; // ENUM with defaultValue → required in creation
  reason: string | null; // TEXT, allowNull: true → T | null
  document_number: string | null; // STRING(50), allowNull: true → T | null
  batch_id: number | null; // allowNull: true → T | null
  user_id: number;
  createdAt?: Date; // timestamp, siempre optional
  updatedAt?: Date; // timestamp, siempre optional
}

interface InventoryMovementCreationAttributes extends Optional<
  InventoryMovementAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'presentation_id' | 'package_quantity' | 'unit_cost' | 'package_cost' | 'reason' | 'document_number' | 'batch_id'
> {}

const InventoryMovement = sequelize.define<Model<InventoryMovementAttributes, InventoryMovementCreationAttributes>>(
  'InventoryMovement',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'products', key: 'id' }
    },
    warehouse_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'warehouses', key: 'id' }
    },
    presentation_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Null = unidades sueltas sin presentación',
      references: { model: 'product_presentations', key: 'id' }
    },
    movement_type: {
      type: DataTypes.ENUM('ingreso', 'egreso', 'ajuste_positivo', 'ajuste_negativo', 'transferencia'),
      allowNull: false
    },
    package_quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Cantidad de paquetes/cajas ingresadas'
    },
    loose_units: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      comment: 'Unidades sueltas sin empaquetar'
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Total en unidades base (calculado automáticamente)'
    },
    unit_cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Costo unitario al momento del movimiento'
    },
    package_cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Costo del paquete al momento del movimiento'
    },
    currency: {
      type: DataTypes.ENUM('USD', 'COP', 'VES'),
      defaultValue: 'USD'
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    document_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Número de factura, remisión, etc.'
    },
    batch_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'batches', key: 'id' }
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    }
  },
  {
    tableName: 'inventory_movements',
    timestamps: true,
    underscored: true
  }
);

export = InventoryMovement;