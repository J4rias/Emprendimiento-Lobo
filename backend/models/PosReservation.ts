import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface PosReservationAttributes {
  id: number;
  session_id: string;
  tab_id: string;
  user_id: number;
  product_id: number;
  presentation_id: number;
  units_reserved: number;
  expires_at: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PosReservationCreationAttributes extends Optional<
  PosReservationAttributes,
  'id' | 'createdAt' | 'updatedAt'
> {}

const PosReservation = sequelize.define<Model<PosReservationAttributes, PosReservationCreationAttributes>>(
  'PosReservation',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    session_id: {
      type: DataTypes.STRING(36),
      allowNull: false,
      comment: 'UUID de la sesión del POS (identificador de dispositivo/navegador)'
    },
    tab_id: {
      type: DataTypes.STRING(36),
      allowNull: false,
      comment: 'UUID de la pestaña dentro de la sesión'
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'Vendedor que hizo la reserva'
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id'
      }
    },
    presentation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'product_presentations',
        key: 'id'
      }
    },
    units_reserved: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Unidades reservadas (en unidades base, equivalentes a inventory.quantity)'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'TTL: timestamp de expiración de la reserva (seguridad ante crash)'
    }
  },
  {
    tableName: 'pos_reservations',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['session_id', 'tab_id', 'presentation_id'],
        name: 'unique_pos_reservation'
      },
      {
        fields: ['product_id'],
        name: 'idx_pos_product_id'
      },
      {
        fields: ['session_id', 'tab_id'],
        name: 'idx_pos_session_tab'
      },
      {
        fields: ['expires_at'],
        name: 'idx_pos_expires_at'
      }
    ]
  }
);

export = PosReservation;