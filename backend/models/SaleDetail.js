const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SaleDetail = sequelize.define('SaleDetail', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sale_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'sales',
      key: 'id'
    },
    comment: 'Venta a la que pertenece'
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    },
    comment: 'Producto vendido'
  },
  presentation_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'product_presentations',
      key: 'id'
    },
    comment: 'Presentación del producto'
  },
  batch_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'batches',
      key: 'id'
    },
    comment: 'Lote del producto (si aplica)'
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Cantidad vendida'
  },
  unit_price: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: false,
    comment: 'Precio unitario al momento de la venta'
  },
  discount_percent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Porcentaje de descuento aplicado'
  },
  discount_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Monto de descuento'
  },
  tax_percent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Porcentaje de impuesto (IVA)'
  },
  tax_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Monto de impuesto'
  },
  subtotal: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: false,
    comment: 'Subtotal de la línea (cantidad * precio)'
  },
  total: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: false,
    comment: 'Total de la línea (subtotal - descuento + impuesto)'
  },
  cost_price: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    comment: 'Precio de costo al momento de la venta (para cálculo de rentabilidad)'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notas específicas del item'
  },
  is_unit: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Indica si la venta se hizo por unidad (true) o por bulto/empaque (false)'
  }
}, {
  tableName: 'sale_details',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['sale_id'] },
    { fields: ['product_id'] },
    { fields: ['presentation_id'] },
    { fields: ['batch_id'] }
  ]
});

module.exports = SaleDetail;
