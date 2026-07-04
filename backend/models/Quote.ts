import { DataTypes, Model, Optional, Op } from 'sequelize';
import { sequelize } from '../config/database';

interface QuoteAttributes {
  id: number;
  code: string;
  customerId: number;
  priceListId: number | null;
  userId: number;
  quoteDate: Date;
  validUntil: Date;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'converted' | 'expired';
  currency: 'USD' | 'COP' | 'VES';
  exchangeRate: number;
  subtotal: number;
  discountPercentage: number;
  discountAmount: number;
  taxPercentage: number;
  taxAmount: number;
  total: number;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  notes: string | null;
  internalNotes: string | null;
  convertedToSaleId: number | null;
  convertedAt: Date | null;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface QuoteCreationAttributes extends Optional<
  QuoteAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'priceListId' | 'quoteDate' | 'status' | 'currency' |
  'exchangeRate' | 'subtotal' | 'discountPercentage' | 'discountAmount' | 'taxPercentage' |
  'taxAmount' | 'total' | 'paymentTerms' | 'deliveryTerms' | 'notes' | 'internalNotes' |
  'convertedToSaleId' | 'convertedAt' | 'isDeleted'
> {}

const Quote = sequelize.define<Model<QuoteAttributes, QuoteCreationAttributes>>(
  'Quote',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    code: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: false,
      comment: 'Código único de la cotización (ej: COT-2025-0001)'
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID del cliente'
    },
    priceListId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID de la lista de precios utilizada'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID del usuario que creó la cotización'
    },
    quoteDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de emisión de la cotización'
    },
    validUntil: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Fecha de vencimiento de la cotización'
    },
    status: {
      type: DataTypes.ENUM('draft', 'sent', 'approved', 'rejected', 'converted', 'expired'),
      allowNull: false,
      defaultValue: 'draft',
      comment: 'Estado de la cotización'
    },
    currency: {
      type: DataTypes.ENUM('USD', 'COP', 'VES'),
      allowNull: false,
      defaultValue: 'USD',
      comment: 'Moneda de la cotización'
    },
    exchangeRate: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      defaultValue: 1,
      comment: 'Tasa de cambio aplicada'
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Subtotal sin impuestos ni descuentos'
    },
    discountPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Porcentaje de descuento general'
    },
    discountAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Monto del descuento'
    },
    taxPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 18,
      comment: 'Porcentaje de impuesto (IVA)'
    },
    taxAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Monto del impuesto'
    },
    total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Total final de la cotización'
    },
    paymentTerms: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Términos de pago'
    },
    deliveryTerms: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Términos de entrega'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales'
    },
    internalNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas internas (no visibles para el cliente)'
    },
    convertedToSaleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID de la venta si fue convertida'
    },
    convertedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de conversión a venta'
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    tableName: 'quotes',
    timestamps: true,
    underscored: true,
    paranoid: false,
    indexes: [
      {
        fields: ['code']
      },
      {
        fields: ['status']
      }
    ],
    hooks: {
      beforeValidate: async (quote: any) => {
        // Generar código automático si no existe
        if (!quote.code) {
          const year = new Date().getFullYear();
          const lastQuote = await Quote.findOne({
            where: {
              code: {
                [Op.like]: `COT-${year}-%`
              }
            },
            order: [['id', 'DESC']],
            paranoid: false
          }) as any;

          let nextNumber = 1;
          if (lastQuote) {
            const lastNumber = parseInt(lastQuote.code.split('-')[2]);
            nextNumber = lastNumber + 1;
          }

          quote.code = `COT-${year}-${String(nextNumber).padStart(5, '0')}`;
        }

        // Calcular fecha de vencimiento por defecto (15 días)
        if (!quote.validUntil) {
          const validUntil = new Date(quote.quoteDate || new Date());
          validUntil.setDate(validUntil.getDate() + 15);
          quote.validUntil = validUntil;
        }
      },
      beforeSave: (quote: any) => {
        // Calcular descuento
        if (quote.discountPercentage > 0) {
          quote.discountAmount = (quote.subtotal * quote.discountPercentage) / 100;
        }

        // Calcular impuesto
        const baseAmount = quote.subtotal - quote.discountAmount;
        quote.taxAmount = (baseAmount * quote.taxPercentage) / 100;

        // Calcular total
        quote.total = baseAmount + quote.taxAmount;
      }
    }
  }
);

// Método para verificar si está vencida
(Quote as any).prototype.isExpired = function() {
  return this.status !== 'converted' &&
         this.status !== 'rejected' &&
         new Date() > new Date(this.validUntil);
};

// Método para verificar si puede ser editada
(Quote as any).prototype.canBeEdited = function() {
  return ['draft', 'sent'].includes(this.status);
};

// Método para verificar si puede ser convertida a venta
(Quote as any).prototype.canBeConverted = function() {
  return this.status === 'approved' && !this.isExpired();
};

// Personalizar JSON
(Quote as any).prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.isDeleted;
  return values;
};

export = Quote;
