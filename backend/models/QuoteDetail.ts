import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// 1. Interfaz con TODOS los campos del modelo (los de la BD + timestamps)
interface QuoteDetailAttributes {
  id: number;
  quote_id: number;
  product_id: number;
  product_presentation_id: number | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  tax_percentage: number;
  tax_amount: number;
  subtotal: number;
  total: number;
  notes: string | null;
  line_order: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

// 2. Atributos opcionales en creación: id + timestamps + campos con defaultValue
interface QuoteDetailCreationAttributes extends Optional<
  QuoteDetailAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'quantity' | 'discount_percentage' | 'discount_amount' | 'tax_percentage' | 'tax_amount' | 'subtotal' | 'total' | 'line_order'
> {}

// 3. sequelize.define con los genéricos
const QuoteDetail = sequelize.define<Model<QuoteDetailAttributes, QuoteDetailCreationAttributes>>(
  'QuoteDetail',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    quote_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID de la cotización'
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID del producto'
    },
    product_presentation_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID de la presentación del producto'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción del producto (guardada al momento de la cotización)'
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 1,
      comment: 'Cantidad cotizada'
    },
    unit_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: 'Precio unitario'
    },
    discount_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Porcentaje de descuento por línea'
    },
    discount_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Monto del descuento por línea'
    },
    tax_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 18,
      comment: 'Porcentaje de impuesto'
    },
    tax_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Monto del impuesto'
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Subtotal de la línea (cantidad * precio unitario)'
    },
    total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Total de la línea (con descuentos e impuestos)'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales para esta línea'
    },
    line_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Orden de la línea en la cotización'
    }
  },
  {
    tableName: 'quote_details',
    timestamps: true,
    underscored: true,
    paranoid: false,
    indexes: [],
    hooks: {
      beforeSave: (detail: any) => {
        // Calcular subtotal
        detail.subtotal = detail.quantity * detail.unit_price;

        // Calcular descuento
        if (detail.discount_percentage > 0) {
          detail.discount_amount = (detail.subtotal * detail.discount_percentage) / 100;
        }

        // Calcular impuesto
        const baseAmount = detail.subtotal - detail.discount_amount;
        detail.tax_amount = (baseAmount * detail.tax_percentage) / 100;

        // Calcular total
        detail.total = baseAmount + detail.tax_amount;
      }
    }
  }
);

export = QuoteDetail;
