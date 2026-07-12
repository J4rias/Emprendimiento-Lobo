import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface DeliveryAttributes {
  id: number;
  delivery_number: string;
  sale_id: number;
  customer_id: number;
  warehouse_id: number;
  delivery_date: Date | null;   // allowNull: true
  scheduled_date: Date;
  delivery_address: string;
  delivery_city: string | null;   // allowNull: true
  delivery_state: string | null;  // allowNull: true
  contact_name: string | null;    // allowNull: true
  contact_phone: string | null;   // allowNull: true
  status: 'pending' | 'in_transit' | 'delivered' | 'failed' | 'cancelled'; // ENUM
  delivery_method: 'pickup' | 'courier' | 'own_fleet' | 'shipping_company'; // ENUM
  tracking_number: string | null; // allowNull: true
  carrier: string | null;         // allowNull: true
  notes: string | null;           // allowNull: true
  delivered_by: number | null;    // allowNull: true
  delivered_at: Date | null;      // allowNull: true
  signature_image_url: string | null; // allowNull: true
  created_by: number;
  createdAt?: Date;              // timestamp, siempre optional
  updatedAt?: Date;              // timestamp, siempre optional
}

interface DeliveryCreationAttributes extends Optional<
  DeliveryAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'delivery_date' | 'delivery_city' | 'delivery_state' |
  'contact_name' | 'contact_phone' | 'tracking_number' | 'carrier' | 'notes' | 'delivered_by' |
  'delivered_at' | 'signature_image_url'
> {}

const Delivery = sequelize.define<Model<DeliveryAttributes, DeliveryCreationAttributes>>(
  'Delivery',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    delivery_number: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
      comment: 'Formato: ENT-YYYYMMDD-####'
    },
    sale_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'sales',
        key: 'id'
      },
      comment: 'Venta asociada a la entrega'
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'customers',
        key: 'id'
      },
      comment: 'Cliente que recibe la entrega'
    },
    warehouse_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'warehouses',
        key: 'id'
      },
      comment: 'Almacén desde donde se despacha'
    },
    delivery_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha real de entrega'
    },
    scheduled_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha programada de entrega'
    },
    delivery_address: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Dirección de entrega'
    },
    delivery_city: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Ciudad de entrega'
    },
    delivery_state: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Estado/Provincia de entrega'
    },
    contact_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Nombre de contacto en la entrega'
    },
    contact_phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Teléfono de contacto'
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_transit', 'delivered', 'failed', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'Estado de la entrega'
    },
    delivery_method: {
      type: DataTypes.ENUM('pickup', 'courier', 'own_fleet', 'shipping_company'),
      allowNull: false,
      defaultValue: 'courier',
      comment: 'Método de entrega'
    },
    tracking_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Número de seguimiento de la transportadora'
    },
    carrier: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Nombre de la transportadora'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales sobre la entrega'
    },
    delivered_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Usuario que confirmó la entrega'
    },
    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora de confirmación de entrega'
    },
    signature_image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL de imagen de firma de recepción (opcional)'
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Usuario que creó la entrega'
    }
  }, {
    tableName: 'deliveries',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_deliveries_sale',
        fields: ['sale_id']
      },
      {
        name: 'idx_deliveries_customer',
        fields: ['customer_id']
      },
      {
        name: 'idx_deliveries_warehouse',
        fields: ['warehouse_id']
      },
      {
        name: 'idx_deliveries_status',
        fields: ['status']
      },
      {
        name: 'idx_deliveries_scheduled_date',
        fields: ['scheduled_date']
      },
      {
        name: 'idx_deliveries_delivery_date',
        fields: ['delivery_date']
      },
      {
        name: 'idx_deliveries_number',
        fields: ['delivery_number']
      }
    ]
  }
);

export = Delivery;