import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// 1. Interfaz con TODOS los campos del modelo (los de la BD + timestamps)
interface CustomerAttributes {
  id: number;
  code: string;
  type: 'natural' | 'juridical';
  documentType: 'V' | 'E' | 'J' | 'G' | 'P';
  documentNumber: string;
  businessName: string | null;
  tradeName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  creditLimit: number;
  creditUsed: number;
  creditDays: number;
  priceListId: number | null;
  discountPercentage: number;
  status: 'active' | 'inactive' | 'blocked';
  notes: string | null;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

// 2. Atributos opcionales en creación: id + timestamps + campos con defaultValue
interface CustomerCreationAttributes extends Optional<
  CustomerAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'type' | 'documentType' | 'country' | 'creditLimit' | 'creditUsed' | 'creditDays' | 'discountPercentage' | 'status' | 'isDeleted'
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
    documentType: {
      type: DataTypes.ENUM('V', 'E', 'J', 'G', 'P'),
      allowNull: false,
      defaultValue: 'V',
      comment: 'Tipo de documento venezolano: V (venezolano), E (extranjero), J (jurídico/RIF), G (gubernamental), P (pasaporte)'
    },
    documentNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: 'Número de documento'
    },
    businessName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Razón social (para personas jurídicas)'
    },
    tradeName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Nombre comercial'
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Nombre (para personas naturales)'
    },
    lastName: {
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
    postalCode: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    creditLimit: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Límite de crédito en moneda local'
    },
    creditUsed: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Crédito actualmente usado por el cliente'
    },
    creditDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Días de crédito permitidos'
    },
    priceListId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Lista de precios asignada al cliente'
    },
    discountPercentage: {
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
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
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
          'postalCode', 'businessName', 'tradeName', 'firstName',
          'lastName', 'notes'
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
    return this.businessName || this.tradeName;
  }
  return `${this.firstName} ${this.lastName}`.trim();
};

// Método para verificar disponibilidad de crédito
(Customer as any).prototype.hasAvailableCredit = function (amount) {
  const availableCredit = parseFloat(this.creditLimit) - parseFloat(this.creditUsed || 0);
  return availableCredit >= amount;
};

// Personalizar JSON para excluir campos sensibles
(Customer as any).prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.isDeleted;
  return values;
};

// 5. export = en lugar de module.exports = (CJS compat con TypeScript)
export = Customer;