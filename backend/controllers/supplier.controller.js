const { Supplier, SupplierContact, PurchaseOrder, SupplierPayment, SupplierPaymentAllocation, ExchangeRate } = require('../models');
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

// Get unified statement (ledger) for a single supplier
const getStatement = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate supplier exists
    const supplier = await Supplier.findByPk(id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    // 1. Fetch Purchase Orders (Debts/Liabilities) - Excluding cancelled ones
    const purchaseOrders = await PurchaseOrder.findAll({
      where: {
        supplier_id: id,
        status: { [Op.notIn]: ['cancelled'] }
      },
      attributes: ['id', 'order_number', 'order_date', 'total', 'currency', 'status']
    });

    // 2. Fetch Supplier Payments (Assets/Credits) - Excluding cancelled ones
    const payments = await SupplierPayment.findAll({
      where: {
        supplier_id: id,
        status: { [Op.notIn]: ['cancelled'] }
      },
      attributes: ['id', 'payment_number', 'payment_date', 'payment_method', 'amount', 'currency', 'status'],
      include: [{
        model: SupplierPaymentAllocation,
        as: 'allocations'
      }]
    });

    // 3. Unify data into Ledger
    const ledger = [];
    const summary = {};

    // Process Purchase Orders (Charges)
    for (const po of purchaseOrders) {
      const amountOrig = parseFloat(po.total || 0);
      const poCurrency = po.currency || 'USD';

      // Get rates
      const rateToUSD = await ExchangeRate.getRate(poCurrency, 'USD', po.order_date);
      const rateToCOP = await ExchangeRate.getRate(poCurrency, 'COP', po.order_date);

      const amtUSD = amountOrig * rateToUSD;
      const amtCOP = amountOrig * rateToCOP;

      // Record in USD
      if (!summary['USD']) summary['USD'] = { total_invoiced: 0, total_paid: 0, balance: 0, available_credit: 0 };
      summary['USD'].total_invoiced += amtUSD;
      ledger.push({
        id: `po_${po.id}_usd`,
        type: 'charge',
        date: new Date(po.order_date),
        reference: po.order_number,
        amount: amtUSD,
        currency: 'USD',
        description: `Orden de Compra: ${po.status}`,
        original_amount: amountOrig,
        original_currency: poCurrency,
        original_data: po
      });

      // Record in COP
      if (!summary['COP']) summary['COP'] = { total_invoiced: 0, total_paid: 0, balance: 0, available_credit: 0 };
      summary['COP'].total_invoiced += amtCOP;
      ledger.push({
        id: `po_${po.id}_cop`,
        type: 'charge',
        date: new Date(po.order_date),
        reference: po.order_number,
        amount: amtCOP,
        currency: 'COP',
        description: `Orden de Compra: ${po.status}`,
        original_amount: amountOrig,
        original_currency: poCurrency,
        original_data: po
      });
    }

    // Process Payments (Credits)
    for (const pay of payments) {
      const amountOrig = parseFloat(pay.amount || 0);
      const payCurrency = pay.currency || 'USD';

      // For payments, we use the exchange_rate stored in the payment if it exists, 
      // otherwise we fetch it from the system.
      let rateToUSD, rateToCOP;

      if (pay.exchange_rate && pay.exchange_rate_from && pay.exchange_rate_to) {
        // If we have a saved rate, we should use it. 
        // This part gets tricky if the saved rate is VES-USD but we need COP.
        // For now, let's keep it simple and fetch if needed.
        rateToUSD = await ExchangeRate.getRate(payCurrency, 'USD', pay.payment_date);
        rateToCOP = await ExchangeRate.getRate(payCurrency, 'COP', pay.payment_date);
      } else {
        rateToUSD = await ExchangeRate.getRate(payCurrency, 'USD', pay.payment_date);
        rateToCOP = await ExchangeRate.getRate(payCurrency, 'COP', pay.payment_date);
      }

      const amtUSD = amountOrig * rateToUSD;
      const amtCOP = amountOrig * rateToCOP;

      // USD
      if (!summary['USD']) summary['USD'] = { total_invoiced: 0, total_paid: 0, balance: 0, available_credit: 0 };
      summary['USD'].total_paid += amtUSD;
      ledger.push({
        id: `pay_${pay.id}_usd`,
        type: 'payment',
        date: new Date(pay.payment_date),
        reference: pay.payment_number,
        amount: amtUSD,
        currency: 'USD',
        description: `Abono (${pay.payment_method})`,
        original_amount: amountOrig,
        original_currency: payCurrency,
        original_data: pay
      });

      // COP
      if (!summary['COP']) summary['COP'] = { total_invoiced: 0, total_paid: 0, balance: 0, available_credit: 0 };
      summary['COP'].total_paid += amtCOP;
      ledger.push({
        id: `pay_${pay.id}_cop`,
        type: 'payment',
        date: new Date(pay.payment_date),
        reference: pay.payment_number,
        amount: amtCOP,
        currency: 'COP',
        description: `Abono (${pay.payment_method})`,
        original_amount: amountOrig,
        original_currency: payCurrency,
        original_data: pay
      });
    }

    // 4. Calculate Final Balances
    for (const currency in summary) {
      summary[currency].balance = summary[currency].total_invoiced - summary[currency].total_paid;
    }

    // 5. Sort Ledger chronologically
    ledger.sort((a, b) => a.date - b.date);

    res.json({
      success: true,
      data: {
        supplier: { id: supplier.id, name: supplier.name, company_name: supplier.company_name },
        summary: summary,
        ledger: ledger
      }
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
  getActive,
  getStatement
};
