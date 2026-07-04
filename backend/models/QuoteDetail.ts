import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// 1. Interfaz con TODOS los campos del modelo (los de la BD + timestamps)
interface QuoteDetailAttributes {
  id: number;
  quoteId: number;
  productId: number;
  productPresentationId: number | null;
  description: string | null;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  discountAmount: number;
  taxPercentage: number;
  taxAmount: number;
  subtotal: number;
  total: number;
  notes: string | null;
  lineOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

// 2. Atributos opcionales en creación: id + timestamps + campos con defaultValue
interface QuoteDetailCreationAttributes extends Optional<
  QuoteDetailAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'quantity' | 'discountPercentage' | 'discountAmount' | 'taxPercentage' | 'taxAmount' | 'subtotal' | 'total' | 'lineOrder'
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
    quoteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID de la cotización'
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID del producto'
    },
    productPresentationId: {
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
    unitPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: 'Precio unitario'
    },
    discountPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Porcentaje de descuento por línea'
    },
    discountAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Monto del descuento por línea'
    },
    taxPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 18,
      comment: 'Porcentaje de impuesto'
    },
    taxAmount: {
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
    lineOrder: {
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
        detail.subtotal = detail.quantity * detail.unitPrice;

        // Calcular descuento
        if (detail.discountPercentage > 0) {
          detail.discountAmount = (detail.subtotal * detail.discountPercentage) / 100;
        }

        // Calcular impuesto
        const baseAmount = detail.subtotal - detail.discountAmount;
        detail.taxAmount = (baseAmount * detail.taxPercentage) / 100;

        // Calcular total
        detail.total = baseAmount + detail.taxAmount;
      }
    }
  }
);

export = QuoteDetail;