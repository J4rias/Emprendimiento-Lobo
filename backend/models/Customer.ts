import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// 1. Interfaz con TODOS los campos del modelo (los de la BD + timestamps)
interface CustomerAttributes {
  id: number;
  code: string;
  type: 'natural' | 'juridical';
  document_type: 'V' | 'E' | 'J' | 'G' | 'P';
  document_number: string;
  business_name: string | null;
  trade_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  credit_limit: number;
  credit_used: number;
  credit_balance: number;
  credit_days: number;
  price_list_id: number | null;
  discount_percentage: number;
  status: 'active' | 'inactive' | 'blocked';
  notes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

// 2. Atributos opcionales en creación: id + timestamps + campos con defaultValue
interface CustomerCreationAttributes extends Optional<
  CustomerAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'type' | 'document_type' | 'country' | 'credit_limit' | 'credit_used' | 'credit_balance' | 'credit_days' | 'discount_percentage' | 'status'
> {}

// 3. sequelize.define con los genéricos
const Customer = sequelize.define<Model<CustomerAttributes, CustomerCreationAttributes>>(
  'Customer',
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
      comment: 'Código único del cliente (ej: CLI-0001)'
    },
    type: {
      type: DataTypes.ENUM('natural', 'juridical'),
      allowNull: false,
      defaultValue: 'natural',
      comment: 'Tipo de cliente: natural o jurídica'
    },
    document_type: {
      type: DataTypes.ENUM('V', 'E', 'J', 'G', 'P'),
      allowNull: false,
      defaultValue: 'V',
      comment: 'Tipo de documento venezolano: V (venezolano), E (extranjero), J (jurídico/RIF), G (gubernamental), P (pasaporte)'
    },
    document_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: 'Número de documento'
    },
    business_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Razón social (para personas jurídicas)'
    },
    trade_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Nombre comercial'
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Nombre (para personas naturales)'
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Apellido (para personas naturales)'
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    mobile: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'Venezuela'
    },
    postal_code: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    credit_limit: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Límite de crédito en moneda local'
    },
    credit_used: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Crédito actualmente usado por el cliente'
    },
    credit_balance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Saldo a favor del cliente (sobrepagos, notas de crédito) en USD'
    },
    credit_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Días de crédito permitidos'
    },
    price_list_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Lista de precios asignada al cliente'
    },
    discount_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Descuento general del cliente (%)'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'blocked'),
      allowNull: false,
      defaultValue: 'active'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
  }, {
    tableName: 'customers',
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
      beforeValidate: async (customer: any) => {
        // Convert empty strings to null for optional fields
        const optionalFields = [
          'email', 'phone', 'mutable', 'address', 'city', 'state',
          'postal_code', 'business_name', 'trade_name', 'first_name',
          'last_name', 'notes'
        ];

        optionalFields.forEach(field => {
          if (customer[field] === '') {
            customer[field] = null;
          }
        });

        // Generar código automático si no existe
        if (!customer.code) {
          const lastCustomer = await (Customer as any).findOne({
            order: [['id', 'DESC']],
            paranoid: false
          });

          const nextNumber = lastCustomer ? lastCustomer.id + 1 : 1;
          customer.code = `CLI-${String(nextNumber).padStart(5, '0')}`;
        }
      }
    }
  }
);

// 4. Cualquier código que venía después (prototype methods, hooks externos, etc.)
// Método para obtener el nombre completo
(Customer as any).prototype.getFullName = function () {
  if (this.type === 'juridical') {
    return this.business_name || this.trade_name;
  }
  return `${this.first_name} ${this.last_name}`.trim();
};

// Método para verificar disponibilidad de crédito
(Customer as any).prototype.hasAvailableCredit = function (amount: any) {
  const availableCredit = parseFloat(this.credit_limit) - parseFloat(this.credit_used || 0);
  return availableCredit >= amount;
};

// Serialización — incluye aliases camelCase para compatibilidad con frontend
(Customer as any).prototype.toJSON = function () {
  const v = { ...this.get() };
  return {
    ...v,
    // fullName / name — computed from type + name fields
    fullName: this.type === 'juridical'
      ? (v.business_name || v.trade_name || '')
      : `${v.first_name || ''} ${v.last_name || ''}`.trim(),
    name: this.type === 'juridical'
      ? (v.business_name || v.trade_name || '')
      : `${v.first_name || ''} ${v.last_name || ''}`.trim(),
    // camelCase aliases (frontend usa estos)
    firstName:          v.first_name,
    lastName:           v.last_name,
    businessName:       v.business_name,
    tradeName:          v.trade_name,
    documentType:       v.document_type,
    documentNumber:     v.document_number,
    creditLimit:        v.credit_limit,
    creditUsed:         v.credit_used,
    creditBalance:      v.credit_balance,
    creditDays:         v.credit_days,
    priceListId:        v.price_list_id,
    discountPercentage: v.discount_percentage,
    postalCode:         v.postal_code,
  };
};

// 5. export = en lugar de module.exports = (CJS compat con TypeScript)
export = Customer;
