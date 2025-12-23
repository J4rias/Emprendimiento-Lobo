const { Supplier, SupplierContact } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

// Get all suppliers with pagination and search
const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: suppliers } = await Supplier.findAndCountAll({
      where: search ? {
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { tax_id: { [Op.like]: `%${search}%` } }
        ]
      } : {},
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: SupplierContact,
          as: 'contacts',
          where: { is_active: true },
          required: false
        }
      ]
    });

    res.json({
      success: true,
      data: suppliers,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get supplier by ID
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findByPk(id, {
      include: [
        {
          model: SupplierContact,
          as: 'contacts',
          where: { is_active: true },
          required: false
        }
      ]
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    next(error);
  }
};

// Create new supplier
const create = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { contacts, ...supplierData } = req.body;
    
    // Create supplier
    const supplier = await Supplier.create({
      ...supplierData,
      created_by: req.userId
    }, { transaction });

    // Create contacts if provided
    if (contacts && contacts.length > 0) {
      // Ensure only one contact is marked as primary
      const hasPrimary = contacts.some(c => c.is_primary);
      const contactsToCreate = contacts.map((contact, index) => ({
        ...contact,
        supplier_id: supplier.id,
        is_primary: index === 0 && !hasPrimary ? true : contact.is_primary,
        created_by: req.userId
      }));

      await SupplierContact.bulkCreate(contactsToCreate, { transaction });
    }

    await transaction.commit();

    // Fetch supplier with contacts
    const supplierWithContacts = await Supplier.findByPk(supplier.id, {
      include: [
        {
          model: SupplierContact,
          as: 'contacts',
          where: { is_active: true },
          required: false
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: supplierWithContacts
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Update supplier
const update = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { contacts, ...supplierData } = req.body;
    
    console.log('Update supplier - req.body:', req.body);
    console.log('Update supplier - supplierData:', supplierData);
    console.log('Update supplier - contacts:', contacts);

    const supplier = await Supplier.findByPk(id, { transaction });
    if (!supplier) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    // Update supplier
    await supplier.update({
      ...supplierData,
      updated_by: req.userId
    }, { transaction });

    // Handle contacts update
    if (contacts) {
      // Get existing contacts
      const existingContacts = await SupplierContact.findAll({
        where: { supplier_id: id },
        transaction
      });

      const existingContactIds = existingContacts.map(c => c.id);
      const newContactIds = contacts.filter(c => c.id).map(c => c.id);
      
      // Ensure only one contact is marked as primary
      const hasPrimary = contacts.some(c => c.is_primary);
      const processedContacts = contacts.map((contact, index) => ({
        ...contact,
        is_primary: index === 0 && !hasPrimary ? true : contact.is_primary
      }));

      // Separate new and existing contacts
      const newContacts = processedContacts.filter(c => !c.id);
      const updatedContacts = processedContacts.filter(c => c.id);

      // Create new contacts
      if (newContacts.length > 0) {
        await SupplierContact.bulkCreate(
          newContacts.map(contact => ({
            ...contact,
            supplier_id: id,
            created_by: req.userId
          })),
          { transaction }
        );
      }

      // Update existing contacts
      for (const contact of updatedContacts) {
        await SupplierContact.update(
          {
            ...contact,
            updated_by: req.userId
          },
          {
            where: {
              id: contact.id,
              supplier_id: id
            },
            transaction
          }
        );
      }

      // Soft delete contacts that are no longer in the list
      const contactsToDelete = existingContactIds.filter(
        id => !newContactIds.includes(id)
      );

      if (contactsToDelete.length > 0) {
        await SupplierContact.update(
          { is_active: false, updated_by: req.userId },
          {
            where: {
              id: contactsToDelete,
              supplier_id: id
            },
            transaction
          }
        );
      }
    }

    await transaction.commit();

    // Fetch supplier with contacts
    const supplierWithContacts = await Supplier.findByPk(id, {
      include: [
        {
          model: SupplierContact,
          as: 'contacts',
          where: { is_active: true },
          required: false
        }
      ]
    });

    res.json({
      success: true,
      message: 'Supplier updated successfully',
      data: supplierWithContacts
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Delete supplier (soft delete)
const deleteSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findByPk(id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    await supplier.update({ is_active: false });

    res.json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get active suppliers for dropdowns
const getActive = async (req, res, next) => {
  try {
    const suppliers = await Supplier.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']],
      attributes: ['id', 'name']
    });

    res.json({
      success: true,
      data: suppliers
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteSupplier,
  getActive
};
