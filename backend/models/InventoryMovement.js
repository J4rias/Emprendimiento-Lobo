const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InventoryMovement = sequelize.define('InventoryMovement', {
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
}, {
  tableName: 'inventory_movements',
  timestamps: true,
  underscored: true
});

module.exports = InventoryMovement;
