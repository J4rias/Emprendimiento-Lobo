import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'CANCEL';

interface AuditLogAttributes {
  id: number;
  table_name: string;
  record_id: number;
  action: AuditAction;
  user_id: number | null;
  ip: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  created_at?: Date;
}

interface AuditLogCreationAttributes extends Optional<AuditLogAttributes, 'id'> {}

class AuditLog extends Model<AuditLogAttributes, AuditLogCreationAttributes>
  implements AuditLogAttributes {
  declare id: number;
  declare table_name: string;
  declare record_id: number;
  declare action: AuditAction;
  declare user_id: number | null;
  declare ip: string | null;
  declare old_values: Record<string, any> | null;
  declare new_values: Record<string, any> | null;
  declare readonly created_at: Date;
}

AuditLog.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    table_name: { type: DataTypes.STRING(64), allowNull: false },
    record_id: { type: DataTypes.INTEGER, allowNull: false },
    action: {
      type: DataTypes.ENUM('CREATE', 'UPDATE', 'DELETE', 'CANCEL'),
      allowNull: false,
    },
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    ip: { type: DataTypes.STRING(45), allowNull: true },
    old_values: { type: DataTypes.JSON, allowNull: true },
    new_values: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    tableName: 'audit_logs',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

export default AuditLog;
