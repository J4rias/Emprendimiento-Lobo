const logger = require('../config/logger');
const {
  SupplierPayment,
  SupplierPaymentAllocation,
  Supplier,
  PurchaseOrder,
  User,
  ExchangeRate,
  sequelize
} = require('../models');
const { Op } = require('sequelize');

/**
 * Generate unique payment number
 * Format: PP-YYYYMMDD-####
 */
const generatePaymentNumber = async () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const prefix = `PP-${dateStr}`;

  // Find the last payment number for today
  const lastPayment = await SupplierPayment.findOne({
    where: {
      payment_number: {
        [Op.like]: `${prefix}%`
      }
    },
    order: [['payment_number', 'DESC']]
  });

  let sequence = 1;
  if (lastPayment) {
    const lastSequence = parseInt(lastPayment.payment_number.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `${prefix}-${String(sequence).padStart(4, '0')}`;
};

/**
 * Get all supplier payments with filters
 * GET /api/supplier-payments
 */
exports.getAllPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      supplier_id,
      payment_method,
      currency,
      date_from,
      date_to
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};

    // Search by payment number or reference
    if (search) {
      where[Op.or] = [
        { payment_number: { [Op.like]: `%${search}%` } },
        { reference: { [Op.like]: `%${search}%` } }
      ];
    }

    // Filter by supplier
    if (supplier_id) {
      where.supplier_id = supplier_id;
    }

    // Filter by payment method
    if (payment_method) {
      where.payment_method = payment_method;
    }

    // Filter by currency
    if (currency) {
      where.currency = currency;
    }

    // Filter by date range
    if (date_from || date_to) {
      where.payment_date = {};
      if (date_from) {
        where.payment_date[Op.gte] = date_from;
      }
      if (date_to) {
        where.payment_date[Op.lte] = date_to;
      }
    }

    // Fetch payments without includes to avoid Sequelize JOIN column collision issues
    const count = await SupplierPayment.count({ where });
    const baseRows = await SupplierPayment.findAll({
      where,
      order: [['payment_date', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Manually enrich with associations to avoid JOIN column collisions
    const paymentIds = baseRows.map(p => p.id).filter(Boolean);
    const supplierIds = [...new Set(baseRows.map(p => p.supplier_id).filter(Boolean))];
    const poIds = [...new Set(baseRows.map(p => p.purchase_order_id).filter(Boolean))];
    const creatorIds = [...new Set(baseRows.map(p => p.created_by).filter(Boolean))];

    const [suppliers, purchaseOrders, allocations, creators] = await Promise.all([
      supplierIds.length ? Supplier.findAll({ where: { id: supplierIds }, attributes: ['id', 'name', 'tax_id', 'payment_terms'] }) : [],
      poIds.length ? PurchaseOrder.findAll({ where: { id: poIds }, attributes: ['id', 'order_number', 'total', 'status'] }) : [],
      paymentIds.length ? SupplierPaymentAllocation.findAll({
        where: { payment_id: paymentIds },
        include: [{ model: PurchaseOrder, as: 'purchaseOrder', attributes: ['id', 'order_number', 'currency'] }]
      }) : [],
      creatorIds.length ? User.findAll({ where: { id: creatorIds }, attributes: ['id', 'username', 'first_name', 'last_name'] }) : []
    ]);

    const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.toJSON()]));
    const poMap = Object.fromEntries(purchaseOrders.map(po => [po.id, po.toJSON()]));
    const creatorMap = Object.fromEntries(creators.map(u => [u.id, u.toJSON()]));
    const allocsByPayment = {};
    for (const a of allocations) {
      if (!allocsByPayment[a.payment_id]) allocsByPayment[a.payment_id] = [];
      allocsByPayment[a.payment_id].push(a.toJSON());
    }

    const rows = baseRows.map(p => ({
      ...p.toJSON(),
      supplier: supplierMap[p.supplier_id] || null,
      purchaseOrder: poMap[p.purchase_order_id] || null,
      creator: creatorMap[p.created_by] || null,
      allocations: allocsByPayment[p.id] || []
    }));

    res.json({
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching supplier payments', { error: error.message });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * Get supplier payment by ID
 * GET /api/supplier-payments/:id
 */
exports.getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await SupplierPayment.findByPk(id, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'name', 'tax_id', 'payment_terms']
        },
        {
          model: PurchaseOrder,
          as: 'purchaseOrder',
          attributes: ['id', 'order_number', 'total', 'status', 'order_date'],
          required: false
        },
        {
          model: SupplierPaymentAllocation,
          as: 'allocations',
          include: [{
            model: PurchaseOrder,
            as: 'purchaseOrder',
            attributes: ['id', 'order_number', 'total', 'currency', 'status']
          }]
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'first_name', 'last_name']
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({
        message: 'Pago no encontrado'
      });
    }

    res.json({
      data: payment
    });
  } catch (error) {
    logger.error('Error fetching payment', { error: error.message });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * Create a new supplier payment
 * POST /api/supplier-payments
 */
exports.createPayment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      supplier_id,
      purchase_order_id,
      payment_date,
      payment_method,
      amount,
      currency,
      reference,
      invoice_number,
      bank_id,
      notes,
      exchange_rate,
      exchange_rate_from,
      exchange_rate_to,
      allocations // NEW: array of { purchase_order_id, invoice_number, allocated_amount }
    } = req.body;

    // Validate required fields
    if (!supplier_id || !payment_date || !payment_method || !amount || !currency) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Faltan campos requeridos: supplier_id, payment_date, payment_method, amount, currency'
      });
    }

    // Validate amount
    if (parseFloat(amount) <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'El monto debe ser mayor que cero'
      });
    }

    // Verify supplier exists
    const supplier = await Supplier.findByPk(supplier_id);
    if (!supplier) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Proveedor no encontrado'
      });
    }

    // Validate allocations total doesn't exceed payment amount
    const allocationsList = allocations || [];
    if (allocationsList.length > 0) {
      const totalAllocated = allocationsList.reduce((sum, a) => sum + parseFloat(a.allocated_amount || 0), 0);
      if (totalAllocated > parseFloat(amount) + 0.01) {
        await transaction.rollback();
        return res.status(400).json({
          message: `La suma de las adjudicaciones (${totalAllocated.toFixed(2)}) excede el monto del pago (${parseFloat(amount).toFixed(2)})`
        });
      }

      // Validate each allocation's PO exists and belongs to the supplier
      for (const alloc of allocationsList) {
        const po = await PurchaseOrder.findByPk(alloc.purchase_order_id);
        if (!po) {
          await transaction.rollback();
          return res.status(404).json({ message: `Orden de compra ${alloc.purchase_order_id} no encontrada` });
        }
        if (po.supplier_id !== parseInt(supplier_id)) {
          await transaction.rollback();
          return res.status(400).json({ message: `La OC ${po.order_number} no pertenece al proveedor seleccionado` });
        }

        // Validate allocation doesn't exceed remaining PO balance
        const poCurrency = po.currency || 'USD';
        const existingAllocations = await SupplierPaymentAllocation.findAll({
          where: { purchase_order_id: alloc.purchase_order_id },
          include: [{ model: SupplierPayment, as: 'payment', where: { status: { [Op.ne]: 'cancelled' } }, attributes: [] }]
        });
        const totalPaidInPOCurrency = existingAllocations.reduce((sum, a) => sum + parseFloat(a.allocated_amount_po_currency || 0), 0);

        // Convert allocation amount to PO currency (freeze it)
        let allocAmountInPOCurrency;
        if (currency === poCurrency) {
          allocAmountInPOCurrency = parseFloat(alloc.allocated_amount);
        } else if (exchange_rate && parseFloat(exchange_rate) > 0) {
          // Use custom rate
          if (exchange_rate_from === currency && exchange_rate_to === poCurrency) {
            allocAmountInPOCurrency = parseFloat(alloc.allocated_amount) * parseFloat(exchange_rate);
          } else if (exchange_rate_from === poCurrency && exchange_rate_to === currency) {
            allocAmountInPOCurrency = parseFloat(alloc.allocated_amount) / parseFloat(exchange_rate);
          } else {
            // Try system exchange rate
            try {
              allocAmountInPOCurrency = await ExchangeRate.convert(parseFloat(alloc.allocated_amount), currency, poCurrency, new Date(payment_date));
            } catch (e) {
              allocAmountInPOCurrency = parseFloat(alloc.allocated_amount);
            }
          }
        } else {
          // Use system exchange rate
          try {
            allocAmountInPOCurrency = await ExchangeRate.convert(parseFloat(alloc.allocated_amount), currency, poCurrency, new Date(payment_date));
          } catch (e) {
            allocAmountInPOCurrency = parseFloat(alloc.allocated_amount);
          }
        }

        alloc._frozen_po_amount = allocAmountInPOCurrency;
        alloc._exchange_rate = currency === poCurrency ? 1 : (exchange_rate ? parseFloat(exchange_rate) : null);

        const poTotal = parseFloat(po.total || 0);
        const saldoPendiente = poTotal - totalPaidInPOCurrency;

        // Previously, we blocked if allocAmountInPOCurrency > saldoPendiente + 0.01
        // Now, we allow overpayment to generate a "saldo a favor" (negative balance)
      }
    } else if (purchase_order_id) {
      // Legacy single-PO mode: create a single allocation automatically
      const po = await PurchaseOrder.findByPk(purchase_order_id);
      if (!po) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Orden de compra no encontrada' });
      }
      if (po.supplier_id !== parseInt(supplier_id)) {
        await transaction.rollback();
        return res.status(400).json({ message: 'La orden de compra no pertenece al proveedor seleccionado' });
      }

      const poCurrency = po.currency || 'USD';
      let frozenAmount;
      let rateUsed = null;
      if (currency === poCurrency) {
        frozenAmount = parseFloat(amount);
        rateUsed = 1;
      } else if (exchange_rate && parseFloat(exchange_rate) > 0) {
        if (exchange_rate_from === currency && exchange_rate_to === poCurrency) {
          frozenAmount = parseFloat(amount) * parseFloat(exchange_rate);
        } else if (exchange_rate_from === poCurrency && exchange_rate_to === currency) {
          frozenAmount = parseFloat(amount) / parseFloat(exchange_rate);
        } else {
          try { frozenAmount = await ExchangeRate.convert(parseFloat(amount), currency, poCurrency, new Date(payment_date)); } catch (e) { frozenAmount = parseFloat(amount); }
        }
        rateUsed = parseFloat(exchange_rate);
      } else {
        try { frozenAmount = await ExchangeRate.convert(parseFloat(amount), currency, poCurrency, new Date(payment_date)); } catch (e) { frozenAmount = parseFloat(amount); }
      }

      allocationsList.push({
        purchase_order_id: purchase_order_id,
        invoice_number: invoice_number || null,
        allocated_amount: parseFloat(amount),
        _frozen_po_amount: frozenAmount,
        _exchange_rate: rateUsed
      });
    }

    if (payment_method === 'credit_balance') {
      // 1. Fetch available credit payments for this supplier and currency, sorted by date ASC (FIFO)
      const allPayments = await SupplierPayment.findAll({
        where: { supplier_id, currency, status: { [Op.ne]: 'cancelled' } },
        include: [{ model: SupplierPaymentAllocation, as: 'allocations' }],
        order: [['payment_date', 'ASC'], ['created_at', 'ASC']],
        transaction
      });

      const availableCredits = allPayments.map(p => {
        const allocSum = p.allocations.reduce((sum, a) => sum + parseFloat(a.allocated_amount), 0);
        return {
          id: p.id,
          available: parseFloat(p.amount) - allocSum
        };
      }).filter(p => p.available > 0.01);

      let totalAvailable = availableCredits.reduce((s, p) => s + p.available, 0);
      const requestedTotal = parseFloat(amount);

      if (requestedTotal > totalAvailable + 0.01) {
        await transaction.rollback();
        return res.status(400).json({ message: `Saldo a favor insuficiente. Disponible: ${totalAvailable.toFixed(2)} ${currency}` });
      }

      // 2. Consume available credits to fulfill allocations
      let creditIdx = 0;
      for (const alloc of allocationsList) {
        let remainingToAllocate = alloc.allocated_amount;
        while (remainingToAllocate > 0.01 && creditIdx < availableCredits.length) {
          const credit = availableCredits[creditIdx];
          const useAmount = Math.min(remainingToAllocate, credit.available);

          if (useAmount > 0.01) {
            // Rate logic: We must calculate how much PO currency this useAmount buys.
            // alloc._frozen_po_amount is the total PO currency bought by alloc.allocated_amount.
            // So fractionally:
            const fraction = useAmount / alloc.allocated_amount;
            const useFrozenPoAmount = alloc._frozen_po_amount * fraction;

            await SupplierPaymentAllocation.create({
              payment_id: credit.id,
              purchase_order_id: alloc.purchase_order_id,
              invoice_number: alloc.invoice_number,
              allocated_amount: useAmount,
              allocated_amount_po_currency: useFrozenPoAmount,
              exchange_rate_used: alloc._exchange_rate
            }, { transaction });

            credit.available -= useAmount;
            remainingToAllocate -= useAmount;
          }

          if (credit.available <= 0.01) {
            creditIdx++;
          }
        }
      }

      await transaction.commit();
      return res.status(201).json({
        message: 'Saldo a favor aplicado exitosamente',
        data: { is_credit_application: true, applied_amount: requestedTotal }
      });
    }

    // Generate payment number
    const payment_number = await generatePaymentNumber();

    // Create payment
    const payment = await SupplierPayment.create({
      payment_number,
      supplier_id,
      purchase_order_id: purchase_order_id || (allocationsList.length === 1 ? allocationsList[0].purchase_order_id : null),
      payment_date,
      payment_method,
      amount: parseFloat(amount),
      currency,
      reference: reference || null,
      invoice_number: invoice_number || null,
      exchange_rate: exchange_rate ? parseFloat(exchange_rate) : null,
      exchange_rate_from: exchange_rate_from || null,
      exchange_rate_to: exchange_rate_to || null,
      status: 'recorded',
      bank_id: bank_id || null,
      notes: notes || null,
      created_by: req.user.id
    }, { transaction });

    // Create allocations
    for (const alloc of allocationsList) {
      await SupplierPaymentAllocation.create({
        payment_id: payment.id,
        purchase_order_id: alloc.purchase_order_id,
        invoice_number: alloc.invoice_number || null,
        allocated_amount: parseFloat(alloc.allocated_amount),
        allocated_amount_po_currency: alloc._frozen_po_amount,
        exchange_rate_used: alloc._exchange_rate
      }, { transaction });
    }

    await transaction.commit();

    // Fetch complete payment data
    const createdPayment = await SupplierPayment.findByPk(payment.id, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'name', 'tax_id', 'payment_terms']
        },
        {
          model: PurchaseOrder,
          as: 'purchaseOrder',
          attributes: ['id', 'order_number', 'total', 'status'],
          required: false
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'first_name', 'last_name']
        },
        {
          model: SupplierPaymentAllocation,
          as: 'allocations',
          include: [{
            model: PurchaseOrder,
            as: 'purchaseOrder',
            attributes: ['id', 'order_number', 'total', 'currency']
          }]
        }
      ]
    });

    res.status(201).json({
      message: 'Pago registrado exitosamente',
      data: createdPayment
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error creating supplier payment', { error: error.message });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * Update a supplier payment
 * PUT /api/supplier-payments/:id
 */
exports.updatePayment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      payment_date,
      payment_method,
      amount,
      currency,
      reference,
      bank_id,
      invoice_number,
      notes
    } = req.body;

    // Find payment
    const payment = await SupplierPayment.findByPk(id);
    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Pago no encontrado'
      });
    }

    // Validate amount if provided
    if (amount && parseFloat(amount) <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'El monto debe ser mayor que cero'
      });
    }

    // Update payment (amount and currency are immutable after creation)
    await payment.update({
      payment_date: payment_date || payment.payment_date,
      payment_method: payment_method || payment.payment_method,
      reference: reference !== undefined ? reference : payment.reference,
      bank_id: bank_id !== undefined ? bank_id : payment.bank_id,
      invoice_number: invoice_number !== undefined ? invoice_number : payment.invoice_number,
      notes: notes !== undefined ? notes : payment.notes
    }, { transaction });

    await transaction.commit();

    // Fetch updated payment
    const updatedPayment = await SupplierPayment.findByPk(id, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'name', 'tax_id', 'payment_terms']
        },
        {
          model: PurchaseOrder,
          as: 'purchaseOrder',
          attributes: ['id', 'order_number', 'total', 'status'],
          required: false
        },
        {
          model: SupplierPaymentAllocation,
          as: 'allocations',
          include: [{
            model: PurchaseOrder,
            as: 'purchaseOrder',
            attributes: ['id', 'order_number', 'total', 'currency', 'status']
          }]
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'first_name', 'last_name']
        }
      ]
    });

    res.json({
      message: 'Pago actualizado exitosamente',
      data: updatedPayment
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error updating supplier payment', { error: error.message });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * "Delete" a supplier payment — cancels it instead of hard-deleting.
 * Hard delete is forbidden because it would silently revert PO balance.
 * DELETE /api/supplier-payments/:id
 */
exports.deletePayment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    const payment = await SupplierPayment.findByPk(id, { transaction });
    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Pago no encontrado' });
    }

    if (payment.status === 'cancelled') {
      await transaction.rollback();
      return res.status(400).json({ message: 'El pago ya está anulado' });
    }

    await payment.update({
      status: 'cancelled',
      notes: reason
        ? `${payment.notes || ''}\n[ANULADO]: ${reason}`.trim()
        : `${payment.notes || ''}\n[ANULADO]`.trim()
    }, { transaction });

    await transaction.commit();

    res.json({
      message: 'Pago anulado exitosamente (los registros se conservan para auditoría)',
      data: payment
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error cancelling payment', { error: error.message });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * Get payments by supplier
 * GET /api/supplier-payments/supplier/:supplierId
 */
exports.getPaymentsBySupplier = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { limit = 50 } = req.query;

    // Verify supplier exists
    const supplier = await Supplier.findByPk(supplierId);
    if (!supplier) {
      return res.status(404).json({
        message: 'Proveedor no encontrado'
      });
    }

    // Get payments for supplier
    const payments = await SupplierPayment.findAll({
      where: { supplier_id: supplierId },
      include: [
        {
          model: PurchaseOrder,
          as: 'purchaseOrder',
          attributes: ['id', 'order_number', 'total', 'status'],
          required: false
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'first_name', 'last_name']
        }
      ],
      order: [['payment_date', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(limit)
    });

    res.json({
      data: payments
    });
  } catch (error) {
    logger.error('Error fetching payments by supplier', { error: error.message });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * Get payment statistics
 * GET /api/supplier-payments/stats
 */
exports.getPaymentStats = async (req, res) => {
  try {
    const { date_from, date_to, supplier_id } = req.query;

    const where = {};

    // Filter by date range
    if (date_from || date_to) {
      where.payment_date = {};
      if (date_from) {
        where.payment_date[Op.gte] = date_from;
      }
      if (date_to) {
        where.payment_date[Op.lte] = date_to;
      }
    }

    // Filter by supplier
    if (supplier_id) {
      where.supplier_id = supplier_id;
    }

    // Total payments count
    const totalPayments = await SupplierPayment.count({ where });

    // Total amount by currency
    const totalByCurrency = await SupplierPayment.findAll({
      where,
      attributes: [
        'currency',
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'payment_count']
      ],
      group: ['currency']
    });

    // Payments by method
    const paymentsByMethod = await SupplierPayment.findAll({
      where,
      attributes: [
        'payment_method',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total']
      ],
      group: ['payment_method']
    });

    // Recent payments (last 5)
    const recentPayments = await SupplierPayment.findAll({
      where,
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'name', 'tax_id']
        }
      ],
      order: [['payment_date', 'DESC'], ['created_at', 'DESC']],
      limit: 5
    });

    res.json({
      data: {
        total_payments: totalPayments,
        total_by_currency: totalByCurrency,
        payments_by_method: paymentsByMethod,
        recent_payments: recentPayments
      }
    });
  } catch (error) {
    logger.error('Error fetching payment stats', { error: error.message });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * Get payments grouped by a specific Purchase Order with balance info
 * GET /api/supplier-payments/by-po/:poId
 */
exports.getPaymentsByPO = async (req, res) => {
  try {
    const { poId } = req.params;

    const purchaseOrder = await PurchaseOrder.findByPk(poId, {
      include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'name'] }]
    });

    if (!purchaseOrder) {
      return res.status(404).json({ message: 'Orden de compra no encontrada' });
    }

    // Use allocations as source of truth for frozen amounts
    const allocations = await SupplierPaymentAllocation.findAll({
      where: { purchase_order_id: poId },
      include: [{
        model: SupplierPayment,
        as: 'payment',
        where: { status: { [Op.ne]: 'cancelled' } },
        include: [
          { model: User, as: 'creator', attributes: ['id', 'username', 'first_name', 'last_name'] }
        ]
      }],
      order: [['created_at', 'DESC']]
    });

    // Frozen balance calculation — never reconverts
    const totalPaidInPOCurrency = allocations.reduce(
      (sum, a) => sum + parseFloat(a.allocated_amount_po_currency || 0), 0
    );

    const poTotal = parseFloat(purchaseOrder.total || 0);
    const saldoPendiente = poTotal - totalPaidInPOCurrency;

    res.json({
      data: {
        purchase_order: {
          id: purchaseOrder.id,
          order_number: purchaseOrder.order_number,
          total: purchaseOrder.total,
          currency: purchaseOrder.currency || 'USD',
          status: purchaseOrder.status,
          supplier: purchaseOrder.supplier
        },
        allocations,
        summary: {
          total_pagado: totalPaidInPOCurrency,
          total_pagado_currency: purchaseOrder.currency || 'USD',
          saldo_pendiente: saldoPendiente,
          saldo_pendiente_currency: purchaseOrder.currency || 'USD',
          esta_pagada_completa: saldoPendiente <= 0.01
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching payments by PO', { error: error.message });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * Get total payable balance for a supplier (received POs minus confirmed payments)
 * GET /api/suppliers/:id/payable-balance  (registered in supplier routes)
 * Also accessible as GET /api/supplier-payments/payable-balance/:supplierId
 */
exports.getPayableBalance = async (req, res) => {
  try {
    const supplierId = req.params.supplierId || req.params.id;

    const supplier = await Supplier.findByPk(supplierId);
    if (!supplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }

    // Get received POs grouped by currency
    const receivedPOs = await PurchaseOrder.findAll({
      where: {
        supplier_id: supplierId,
        status: { [Op.in]: ['received', 'partially_received'] }
      },
      attributes: ['id', 'order_number', 'total', 'currency', 'status']
    });

    // Use allocations (frozen amounts) for balance calculation
    const posWithBalance = await Promise.all(receivedPOs.map(async (po) => {
      const allocations = await SupplierPaymentAllocation.findAll({
        where: { purchase_order_id: po.id },
        include: [{
          model: SupplierPayment,
          as: 'payment',
          where: { status: { [Op.ne]: 'cancelled' } },
          attributes: []
        }]
      });

      const totalPaid = allocations.reduce(
        (sum, a) => sum + parseFloat(a.allocated_amount_po_currency || 0), 0
      );

      const poTotal = parseFloat(po.total || 0);
      return {
        id: po.id,
        order_number: po.order_number,
        total: poTotal,
        currency: po.currency || 'USD',
        status: po.status,
        total_paid: totalPaid,
        balance: poTotal - totalPaid
      };
    }));

    // Group totals by currency
    const byCurrency = {};
    for (const po of posWithBalance) {
      if (!byCurrency[po.currency]) {
        byCurrency[po.currency] = { total_ocs: 0, total_paid: 0, balance: 0 };
      }
      byCurrency[po.currency].total_ocs += po.total;
      byCurrency[po.currency].total_paid += po.total_paid;
      byCurrency[po.currency].balance += po.balance;
    }

    res.json({
      data: {
        supplier: { id: supplier.id, name: supplier.name },
        summary_by_currency: byCurrency,
        purchase_orders: posWithBalance
      }
    });
  } catch (error) {
    logger.error('Error fetching payable balance', { error: error.message });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * Get available credit balance (saldo a favor) for a supplier
 * GET /api/supplier-payments/credit-balance/:supplierId
 */
exports.getSupplierCreditBalance = async (req, res) => {
  try {
    const supplierId = req.params.supplierId;

    const supplier = await Supplier.findByPk(supplierId);
    if (!supplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }

    // Fetch all confirmed payments
    const payments = await SupplierPayment.findAll({
      where: {
        supplier_id: supplierId,
        status: { [Op.ne]: 'cancelled' }
      },
      include: [{
        model: SupplierPaymentAllocation,
        as: 'allocations'
      }]
    });

    const creditByCurrency = {};

    payments.forEach(p => {
      const cur = p.currency || 'USD';
      if (!creditByCurrency[cur]) {
        creditByCurrency[cur] = { total_payments: 0, total_allocated: 0, available_credit: 0 };
      }

      const allocSum = p.allocations.reduce((sum, a) => sum + parseFloat(a.allocated_amount || 0), 0);
      const unallocated = parseFloat(p.amount) - allocSum;

      creditByCurrency[cur].total_payments += parseFloat(p.amount);
      creditByCurrency[cur].total_allocated += allocSum;

      if (unallocated > 0.001) {
        creditByCurrency[cur].available_credit += unallocated;
      }
    });

    res.json({
      data: creditByCurrency
    });
  } catch (error) {
    logger.error('Error fetching credit balance', { error: error.message });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

/**
 * Cancel a supplier payment (change status to cancelled)
 * PUT /api/supplier-payments/:id/cancel
 */
exports.cancelPayment = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const payment = await SupplierPayment.findByPk(id, { transaction });
    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Pago no encontrado' });
    }

    if (payment.status === 'cancelled') {
      await transaction.rollback();
      return res.status(400).json({ message: 'El pago ya está anulado' });
    }

    await payment.update({
      status: 'cancelled',
      notes: reason ? `${payment.notes || ''}\n[ANULADO]: ${reason}`.trim() : payment.notes
    }, { transaction });

    await transaction.commit();

    res.json({
      message: 'Pago anulado exitosamente',
      data: payment
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error cancelling payment', { error: error.message });
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};