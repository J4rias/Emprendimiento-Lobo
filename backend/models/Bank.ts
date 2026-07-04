import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface BankAttributes {
  id: number;
  name: string;
  currency: 'USD' | 'COP' | 'VES';
  type: 'bank' | 'wallet' | 'other';
  is_active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface BankCreationAttributes extends Optional<
  BankAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'type' | 'is_active'
> {}

const Bank = sequelize.define<Model<BankAttributes, BankCreationAttributes>>(
  'Bank',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Nombre del banco o entidad financiera'
    },
    currency: {
      type: DataTypes.ENUM('USD', 'COP', 'VES'),
      allowNull: false,
      comment: 'Moneda principal del banco'
    },
    type: {
      type: DataTypes.ENUM('bank', 'wallet', 'other'),
      allowNull: false,
      defaultValue: 'bank',
      comment: 'Tipo: bank=banco tradicional, wallet=billetera digital, other=otro'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    tableName: 'banks',
    timestamps: true,
    underscored: true
  }
);

export = Bank;