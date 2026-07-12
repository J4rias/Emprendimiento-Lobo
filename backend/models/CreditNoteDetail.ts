import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface CreditNoteDetailAttributes {
  id: number;
  credit_note_id: number;
  sale_detail_id: number;
  product_id: number;
  presentation_id: number;
  batch_id: number | null;
  package_quantity_returned: number;
  loose_units_returned: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  line_total: number;
  return_to_stock: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CreditNoteDetailCreationAttributes extends Optional<
  CreditNoteDetailAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'batch_id'
> {}

const CreditNoteDetail = sequelize.define<Model<CreditNoteDetailAttributes, CreditNoteDetailCreationAttributes>>(
  'CreditNoteDetail',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    credit_note_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'credit_notes',
        key: 'id'
      },
      comment: 'Nota de crédito a la que pertenece'
    },
    sale_detail_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'sale_details',
        key: 'id'
      },
      comment: 'Detalle de venta original'
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id'
      },
      comment: 'Producto devuelto'
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
    package_quantity_returned: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Cantidad de paquetes devueltos'
    },
    loose_units_returned: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Cantidad de unidades sueltas devueltas'
    },
    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Precio unitario del producto en la venta original'
    },
    discount_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Porcentaje de descuento aplicado'
    },
    tax_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Porcentaje de impuesto'
    },
    line_total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Total de la línea'
    },
    return_to_stock: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si se debe devolver el producto al inventario'
    }
  },
  {
    tableName: 'credit_note_details',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_credit_note_details_credit_note',
        fields: ['credit_note_id']
      },
      {
        name: 'idx_credit_note_details_sale_detail',
        fields: ['sale_detail_id']
      },
      {
        name: 'idx_credit_note_details_product',
        fields: ['product_id']
      },
      {
        name: 'idx_credit_note_details_presentation',
        fields: ['presentation_id']
      }
    ]
  }
);

export = CreditNoteDetail;