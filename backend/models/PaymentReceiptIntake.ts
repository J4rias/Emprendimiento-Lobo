import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface PaymentReceiptIntakeAttributes {
  id: number;
  flow: 'ventas' | 'compras';
  status: 'pendiente' | 'conciliado' | 'sin_match' | 'conflicto';
  banco: string | null;
  fecha: string | null;
  referencia: string | null;
  monto: number | null;
  moneda: string | null;
  origen_nombre: string | null;
  origen_cuenta: string | null;
  destino_nombre: string | null;
  destino_cuenta: string | null;
  concepto: string | null;
  tipo_pantalla: string | null;
  image_url: string | null;
  confidence: number | null;
  raw_payload: object | null;
  sale_payment_id: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PaymentReceiptIntakeCreationAttributes extends Optional<
  PaymentReceiptIntakeAttributes,
  'id' | 'flow' | 'status' | 'banco' | 'fecha' | 'referencia' | 'monto' | 'moneda' |
  'origen_nombre' | 'origen_cuenta' | 'destino_nombre' | 'destino_cuenta' | 'concepto' |
  'tipo_pantalla' | 'image_url' | 'confidence' | 'raw_payload' | 'sale_payment_id' |
  'createdAt' | 'updatedAt'
> {}

const PaymentReceiptIntake = sequelize.define<
  Model<PaymentReceiptIntakeAttributes, PaymentReceiptIntakeCreationAttributes>
>(
  'PaymentReceiptIntake',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    flow: {
      type: DataTypes.ENUM('ventas', 'compras'),
      allowNull: false,
      defaultValue: 'ventas'
    },
    status: {
      type: DataTypes.ENUM('pendiente', 'conciliado', 'sin_match', 'conflicto'),
      allowNull: false,
      defaultValue: 'pendiente'
    },
    banco: { type: DataTypes.STRING(100), allowNull: true },
    fecha: { type: DataTypes.DATEONLY, allowNull: true },
    referencia: { type: DataTypes.STRING(100), allowNull: true },
    monto: { type: DataTypes.DECIMAL(18, 6), allowNull: true },
    moneda: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Texto tal cual lo extrae GLM (ej. "$", "Bs", "USDT"), no el ENUM de 3 monedas del ERP'
    },
    origen_nombre: { type: DataTypes.STRING(150), allowNull: true },
    origen_cuenta: { type: DataTypes.STRING(100), allowNull: true },
    destino_nombre: { type: DataTypes.STRING(150), allowNull: true },
    destino_cuenta: { type: DataTypes.STRING(100), allowNull: true },
    concepto: { type: DataTypes.TEXT, allowNull: true },
    tipo_pantalla: { type: DataTypes.STRING(100), allowNull: true },
    image_url: { type: DataTypes.STRING(255), allowNull: true },
    confidence: { type: DataTypes.DECIMAL(5, 2), allowNull: true, comment: '0-100, si el bot la reporta' },
    raw_payload: { type: DataTypes.JSON, allowNull: true, comment: 'JSON crudo recibido del bot, para auditoría' },
    sale_payment_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'sale_payments', key: 'id' },
      comment: 'Se llena cuando exista el motor de matching (fase posterior)'
    }
  },
  {
    tableName: 'payment_receipt_intake',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['flow', 'status'] },
      { fields: ['fecha'] }
    ]
  }
);

export = PaymentReceiptIntake;
