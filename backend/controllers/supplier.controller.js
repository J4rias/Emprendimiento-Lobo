const { Supplier, SupplierContact, PurchaseOrder, SupplierPayment, SupplierPaymentAllocation, ExchangeRate } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../config/logger');

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
        message: 'Supplier not found'
      });
    }

    res.json({
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
      created_by: req.user.id
    }, { transaction });

    // Create contacts if provided
    if (contacts && contacts.length > 0) {
      // Ensure only one contact is marked as primary
      const hasPrimary = contacts.some(c => c.is_primary);
      const contactsToCreate = contacts.map((contact, index) => ({
        ...contact,
        supplier_id: supplier.id,
        is_primary: index === 0 && !hasPrimary ? true : contact.is_primary,
        created_by: req.user.id
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

    logger.info('Update supplier - req.body:', req.body);
    logger.info('Update supplier - supplierData:', supplierData);
    logger.info('Update supplier - contacts:', contacts);

    const supplier = await Supplier.findByPk(id, { transaction });
    if (!supplier) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Supplier not found'
      });
    }

    // Update supplier
    await supplier.update({
      ...supplierData,
      updated_by: req.user.id
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
            created_by: req.user.id
          })),
          { transaction }
        );
      }

      // Update existing contacts
      for (const contact of updatedContacts) {
        await SupplierContact.update(
          {
            ...contact,
            updated_by: req.user.id
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
          { is_active: false, updated_by: req.user.id },
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
        message: 'Supplier not found'
      });
    }

    await supplier.update({ is_active: false });

    res.json({
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
      return res.status(404).json({ message: 'Supplier not found' });
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

// Helper: derive ledger category from PO currency + settlement_currency
function getLedgerCategory(currency, settlementCurrency) {
  if (currency === 'COP') return 'COP';
  if (currency === 'USD' && settlementCurrency === 'USD') return 'DIVISAS';
  // USD paid in VES (default), or VES paid in VES
  return 'USD';
}

// Helper: infer category from payment currency (for unallocated payments)
function inferCategoryFromPaymentCurrency(paymentCurrency) {
  if (paymentCurrency === 'VES') return 'USD';
  if (paymentCurrency === 'USD') return 'DIVISAS';
  if (paymentCurrency === 'COP') return 'COP';
  return 'USD';
}

// Get supplier ledger grouped by category (USD/DIVISAS/COP)
// Matches the spreadsheet layout: invoices left, payments right, per category
const getLedger = async (req, res, next) => {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findByPk(id);
    if (!supplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }

    // 1. Get all non-cancelled POs for this supplier
    const purchaseOrders = await PurchaseOrder.findAll({
      where: {
        supplier_id: id,
        status: { [Op.notIn]: ['cancelled'] }
      },
      attributes: ['id', 'order_number', 'order_date', 'total', 'currency', 'settlement_currency', 'status', 'notes'],
      order: [['order_date', 'ASC']]
    });

    // 2. Get all non-cancelled payments with allocations
    const payments = await SupplierPayment.findAll({
      where: {
        supplier_id: id,
        status: { [Op.notIn]: ['cancelled'] }
      },
      attributes: ['id', 'payment_number', 'payment_date', 'payment_method', 'amount', 'currency', 'reference', 'exchange_rate', 'exchange_rate_from', 'exchange_rate_to', 'notes'],
      include: [{
        model: SupplierPaymentAllocation,
        as: 'allocations',
        attributes: ['id', 'purchase_order_id', 'allocated_amount', 'allocated_amount_po_currency', 'exchange_rate_used']
      }],
      order: [['payment_date', 'ASC']]
    });

    // 3. Build PO category map
    const poMap = {};
    const categories = {};

    for (const po of purchaseOrders) {
      const cat = getLedgerCategory(po.currency, po.settlement_currency);
      poMap[po.id] = cat;

      if (!categories[cat]) {
        categories[cat] = { total_invoiced: 0, total_paid: 0, balance: 0, invoices: [], payments: [] };
      }

      const poTotal = parseFloat(po.total || 0);
      categories[cat].total_invoiced += poTotal;
      categories[cat].invoices.push({
        id: po.id,
        date: po.order_date,
        description: po.order_number,
        amount: poTotal,
        status: po.status,
        notes: po.notes
      });
    }

    // 4. Process payments - assign to categories via allocations
    for (const payment of payments) {
      const paymentAmount = parseFloat(payment.amount || 0);
      const paymentCurrency = payment.currency || 'USD';

      if (payment.allocations && payment.allocations.length > 0) {
        // Group allocations by category
        const allocByCategory = {};

        for (const alloc of payment.allocations) {
          const cat = poMap[alloc.purchase_order_id];
          if (!cat) continue;

          if (!allocByCategory[cat]) {
            allocByCategory[cat] = { amountPoCurrency: 0, amountPayCurrency: 0 };
          }
          allocByCategory[cat].amountPoCurrency += parseFloat(alloc.allocated_amount_po_currency || 0);
          allocByCategory[cat].amountPayCurrency += parseFloat(alloc.allocated_amount || 0);
        }

        for (const [cat, alloc] of Object.entries(allocByCategory)) {
          if (!categories[cat]) {
            categories[cat] = { total_invoiced: 0, total_paid: 0, balance: 0, invoices: [], payments: [] };
          }

          categories[cat].total_paid += alloc.amountPoCurrency;
          categories[cat].payments.push({
            id: payment.id,
            date: payment.payment_date,
            description: payment.reference || payment.payment_number,
            payment_number: payment.payment_number,
            payment_method: payment.payment_method,
            bcv_rate: (paymentCurrency === 'VES' && payment.exchange_rate) ? parseFloat(payment.exchange_rate) : null,
            amount_ves: paymentCurrency === 'VES' ? paymentAmount : null,
            amount: alloc.amountPoCurrency
          });
        }
      } else {
        // Unallocated payment - infer category from payment currency
        const cat = inferCategoryFromPaymentCurrency(paymentCurrency);
        if (!categories[cat]) {
          categories[cat] = { total_invoiced: 0, total_paid: 0, balance: 0, invoices: [], payments: [] };
        }

        // Calculate equivalent in the category's native currency
        let amountInCategoryCurrency = paymentAmount;
        if (paymentCurrency === 'VES' && payment.exchange_rate) {
          // VES → USD: divide by BCV rate (exchange_rate = 1 USD = X VES)
          amountInCategoryCurrency = paymentAmount / parseFloat(payment.exchange_rate);
        }

        categories[cat].total_paid += amountInCategoryCurrency;
        categories[cat].payments.push({
          id: payment.id,
          date: payment.payment_date,
          description: payment.reference || payment.payment_number,
          payment_number: payment.payment_number,
          payment_method: payment.payment_method,
          bcv_rate: (paymentCurrency === 'VES' && payment.exchange_rate) ? parseFloat(payment.exchange_rate) : null,
          amount_ves: paymentCurrency === 'VES' ? paymentAmount : null,
          amount: amountInCategoryCurrency
        });
      }
    }

    // 5. Calculate balances and sort
    for (const cat in categories) {
      categories[cat].balance = Math.round((categories[cat].total_invoiced - categories[cat].total_paid) * 100) / 100;
      categories[cat].total_invoiced = Math.round(categories[cat].total_invoiced * 100) / 100;
      categories[cat].total_paid = Math.round(categories[cat].total_paid * 100) / 100;
      categories[cat].invoices.sort((a, b) => new Date(a.date) - new Date(b.date));
      categories[cat].payments.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // 6. Get current BCV rate
    let bcvRate = null;
    try {
      bcvRate = await ExchangeRate.getRate('USD', 'VES');
    } catch (e) { /* rate not available */ }

    res.json({
      data: {
        supplier: { id: supplier.id, name: supplier.name },
        bcv_rate: bcvRate,
        categories
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get summary of all suppliers with balances by category (RESUMEN DE PROVEEDORES)
const getResumen = async (req, res, next) => {
  try {
    // 1. Get all non-cancelled POs with supplier info (batch query)
    const purchaseOrders = await PurchaseOrder.findAll({
      where: { status: { [Op.notIn]: ['cancelled'] } },
      attributes: ['id', 'supplier_id', 'total', 'currency', 'settlement_currency'],
      include: [{
        model: Supplier,
        as: 'supplier',
        attributes: ['id', 'name'],
        where: { is_active: true }
      }]
    });

    if (purchaseOrders.length === 0) {
      let bcvRate = null;
      try { bcvRate = await ExchangeRate.getRate('USD', 'VES'); } catch (e) {}
      return res.json({
        data: { bcv_rate: bcvRate, totals: { USD: 0, DIVISAS: 0, COP: 0 }, ves_needed: 0, suppliers: [] }
      });
    }

    // 2. Get all allocations for these POs in one query
    const poIds = purchaseOrders.map(p => p.id);
    const allocations = await SupplierPaymentAllocation.findAll({
      where: { purchase_order_id: { [Op.in]: poIds } },
      attributes: ['purchase_order_id', 'allocated_amount_po_currency'],
      include: [{
        model: SupplierPayment,
        as: 'payment',
        where: { status: { [Op.ne]: 'cancelled' } },
        attributes: []
      }]
    });

    // 3. Build paid-per-PO map
    const paidMap = {};
    for (const alloc of allocations) {
      const poId = alloc.purchase_order_id;
      paidMap[poId] = (paidMap[poId] || 0) + parseFloat(alloc.allocated_amount_po_currency || 0);
    }

    // 4. Aggregate by supplier + category
    const supplierMap = {};
    for (const po of purchaseOrders) {
      const supplierId = po.supplier_id;
      const cat = getLedgerCategory(po.currency, po.settlement_currency);
      const poTotal = parseFloat(po.total || 0);
      const poPaid = paidMap[po.id] || 0;
      const poBalance = poTotal - poPaid;

      if (!supplierMap[supplierId]) {
        supplierMap[supplierId] = {
          id: supplierId,
          name: po.supplier.name,
          balances: { USD: 0, DIVISAS: 0, COP: 0 }
        };
      }

      supplierMap[supplierId].balances[cat] = (supplierMap[supplierId].balances[cat] || 0) + poBalance;
    }

    // 5. Handle unallocated payments (payments without allocations don't reduce PO balances)
    const allPayments = await SupplierPayment.findAll({
      where: { status: { [Op.ne]: 'cancelled' } },
      attributes: ['id', 'supplier_id', 'amount', 'currency', 'exchange_rate'],
      include: [
        {
          model: SupplierPaymentAllocation,
          as: 'allocations',
          attributes: ['allocated_amount']
        },
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'name'],
          where: { is_active: true }
        }
      ]
    });

    for (const pay of allPayments) {
      const totalAllocated = (pay.allocations || []).reduce(
        (sum, a) => sum + parseFloat(a.allocated_amount || 0), 0
      );
      const payAmount = parseFloat(pay.amount || 0);
      const unallocated = payAmount - totalAllocated;
      if (Math.abs(unallocated) < 0.01) continue;

      const payCurrency = pay.currency || 'USD';
      const cat = inferCategoryFromPaymentCurrency(payCurrency);

      let amountInCat = unallocated;
      if (payCurrency === 'VES' && pay.exchange_rate) {
        amountInCat = unallocated / parseFloat(pay.exchange_rate);
      }

      if (!supplierMap[pay.supplier_id]) {
        supplierMap[pay.supplier_id] = {
          id: pay.supplier_id,
          name: pay.supplier.name,
          balances: { USD: 0, DIVISAS: 0, COP: 0 }
        };
      }

      supplierMap[pay.supplier_id].balances[cat] -= amountInCat;
    }

    // 6. Round balances, filter suppliers with zero balance, sort descending
    const suppliers = Object.values(supplierMap)
      .map(s => {
        s.balances.USD = Math.round((s.balances.USD || 0) * 100) / 100;
        s.balances.DIVISAS = Math.round((s.balances.DIVISAS || 0) * 100) / 100;
        s.balances.COP = Math.round((s.balances.COP || 0) * 100) / 100;
        return s;
      })
      .filter(s => Math.abs(s.balances.USD) > 0.01 || Math.abs(s.balances.DIVISAS) > 0.01 || Math.abs(s.balances.COP) > 0.01)
      .sort((a, b) => {
        // Sort by largest absolute balance (across all categories)
        const totalA = Math.abs(a.balances.USD) + Math.abs(a.balances.DIVISAS) + Math.abs(a.balances.COP);
        const totalB = Math.abs(b.balances.USD) + Math.abs(b.balances.DIVISAS) + Math.abs(b.balances.COP);
        return totalB - totalA;
      });

    // 7. Calculate column totals
    const totals = { USD: 0, DIVISAS: 0, COP: 0 };
    for (const s of suppliers) {
      totals.USD += s.balances.USD;
      totals.DIVISAS += s.balances.DIVISAS;
      totals.COP += s.balances.COP;
    }
    totals.USD = Math.round(totals.USD * 100) / 100;
    totals.DIVISAS = Math.round(totals.DIVISAS * 100) / 100;
    totals.COP = Math.round(totals.COP * 100) / 100;

    // 8. Get current BCV rate and calculate VES needed
    let bcvRate = null;
    let vesNeeded = 0;
    try {
      bcvRate = await ExchangeRate.getRate('USD', 'VES');
      vesNeeded = Math.round(totals.USD * bcvRate * 100) / 100;
    } catch (e) { /* rate not available */ }

    res.json({
      data: {
        bcv_rate: bcvRate,
        totals,
        ves_needed: vesNeeded,
        suppliers
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
  getStatement,
  getLedger,
  getResumen
};