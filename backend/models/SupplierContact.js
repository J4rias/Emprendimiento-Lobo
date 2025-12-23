const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SupplierContact = sequelize.define('SupplierContact', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  supplier_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'suppliers',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: 'Nombre completo del contacto'
  },
  position: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Cargo del contacto'
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      isEmailOrEmpty(value) {
        if (value && value.trim() !== '') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            throw new Error('Debe ser un email válido');
          }
        }
      }
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
  is_primary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Indica si es el contacto principal'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notas adicionales del contacto'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'supplier_contacts',
  timestamps: true,
  indexes: [
    {
      unique: false,
      fields: ['supplier_id']
    },
    {
      unique: false,
      fields: ['supplier_id', 'is_primary']
    }
  ]
});

// Asociaciones
SupplierContact.associate = (models) => {
  SupplierContact.belongsTo(models.Supplier, {
    foreignKey: 'supplier_id',
    as: 'supplier'
  });
};

module.exports = SupplierContact;
