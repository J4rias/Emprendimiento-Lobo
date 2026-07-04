import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

const bcrypt = require('bcryptjs');
const { bcrypt: bcryptConfig } = require('../config/auth');

interface UserAttributes {
  id: number;
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: Date | null;
  last_login: Date | null;
  role_id: number;
  credit_pin: string | null;
  credit_pin_attempts: number;
  credit_pin_locked_until: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserCreationAttributes extends Optional<
  UserAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'is_active' | 'failed_login_attempts' |
  'credit_pin' | 'credit_pin_attempts' | 'credit_pin_locked_until'
> {}

const User = sequelize.define<Model<UserAttributes, UserCreationAttributes>>(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50]
      }
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    first_name: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    last_name: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    failed_login_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'roles',
        key: 'id'
      }
    },
    credit_pin: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'PIN hasheado para autorizar operaciones de crédito'
    },
    credit_pin_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Intentos fallidos del PIN de crédito'
    },
    credit_pin_locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha hasta la que el PIN de crédito está bloqueado'
    }
  },
  {
    tableName: 'users',
    timestamps: true,
    hooks: {
      beforeCreate: async (user: any) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, bcryptConfig.rounds);
        }
      },
      beforeUpdate: async (user: any) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, bcryptConfig.rounds);
        }
      }
    }
  }
);

(User.prototype as any).comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

(User.prototype as any).toJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.password;
  delete values.failed_login_attempts;
  delete values.locked_until;
  delete values.credit_pin;
  delete values.credit_pin_attempts;
  delete values.credit_pin_locked_until;
  return values;
};

export = User;