const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Customer = sequelize.define('Customer', {
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
    beforeValidate: async (customer) => {
      // Convert empty strings to null for optional fields
      const optionalFields = [
        'email', 'phone', 'mobile', 'address', 'city', 'state',
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
        const lastCustomer = await Customer.findOne({
          order: [['id', 'DESC']],
          paranoid: false
        });

        const nextNumber = lastCustomer ? lastCustomer.id + 1 : 1;
        customer.code = `CLI-${String(nextNumber).padStart(5, '0')}`;
      }
    }
  }
});

// Método para obtener el nombre completo
Customer.prototype.getFullName = function () {
  if (this.type === 'juridical') {
    return this.businessName || this.tradeName;
  }
  return `${this.firstName} ${this.lastName}`.trim();
};

// Método para verificar disponibilidad de crédito
Customer.prototype.hasAvailableCredit = function (amount) {
  const availableCredit = parseFloat(this.creditLimit) - parseFloat(this.creditUsed || 0);
  return availableCredit >= amount;
};

// Personalizar JSON para excluir campos sensibles
Customer.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.isDeleted;
  return values;
};

module.exports = Customer;
