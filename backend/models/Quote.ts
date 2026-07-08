import { DataTypes, Model, Optional, Op } from 'sequelize';
import { sequelize } from '../config/database';

interface QuoteAttributes {
  id: number;
  code: string;
  customer_id: number;
  price_list_id: number | null;
  user_id: number;
  quote_date: Date;
  valid_until: Date;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'converted' | 'expired';
  currency: 'USD' | 'COP' | 'VES';
  exchange_rate: number;
  subtotal: number;
  discount_percentage: number;
  discount_amount: number;
  tax_percentage: number;
  tax_amount: number;
  total: number;
  payment_terms: string | null;
  delivery_terms: string | null;
  notes: string | null;
  internal_notes: string | null;
  converted_to_sale_id: number | null;
  converted_at: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

interface QuoteCreationAttributes extends Optional<
  QuoteAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'price_list_id' | 'quote_date' | 'status' | 'currency' |
  'exchange_rate' | 'subtotal' | 'discount_percentage' | 'discount_amount' | 'tax_percentage' |
  'tax_amount' | 'total' | 'payment_terms' | 'delivery_terms' | 'notes' | 'internal_notes' |
  'converted_to_sale_id' | 'converted_at'
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
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID del cliente'
    },
    price_list_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID de la lista de precios utilizada'
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID del usuario que creó la cotización'
    },
    quote_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha de emisión de la cotización'
    },
    valid_until: {
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
    exchange_rate: {
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
    discount_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Porcentaje de descuento general'
    },
    discount_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Monto del descuento'
    },
    tax_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 18,
      comment: 'Porcentaje de impuesto (IVA)'
    },
    tax_amount: {
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
    payment_terms: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Términos de pago'
    },
    delivery_terms: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Términos de entrega'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales'
    },
    internal_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas internas (no visibles para el cliente)'
    },
    converted_to_sale_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID de la venta si fue convertida'
    },
    converted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de conversión a venta'
    },
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
        if (!quote.valid_until) {
          const validUntil = new Date(quote.quote_date || new Date());
          validUntil.setDate(validUntil.getDate() + 15);
          quote.valid_until = validUntil;
        }
      },
      beforeSave: (quote: any) => {
        // Calcular descuento
        if (quote.discount_percentage > 0) {
          quote.discount_amount = (quote.subtotal * quote.discount_percentage) / 100;
        }

        // Calcular impuesto
        const baseAmount = quote.subtotal - quote.discount_amount;
        quote.tax_amount = (baseAmount * quote.tax_percentage) / 100;

        // Calcular total
        quote.total = baseAmount + quote.tax_amount;
      }
    }
  }
);

// Método para verificar si está vencida
(Quote as any).prototype.isExpired = function() {
  return this.status !== 'converted' &&
         this.status !== 'rejected' &&
         new Date() > new Date(this.valid_until);
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
  return values;
};

export = Quote;
