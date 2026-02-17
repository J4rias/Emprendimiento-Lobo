const {
  SupplierPayment,
  Supplier,
  PurchaseOrder,
  User,
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
      start_date,
      end_date
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
    if (start_date || end_date) {
      where.payment_date = {};
      if (start_date) {
        where.payment_date[Op.gte] = start_date;
      }
      if (end_date) {
        where.payment_date[Op.lte] = end_date;
      }
    }

    // Query payments
    const { count, rows } = await SupplierPayment.findAndCountAll({
      where,
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
        }
      ],
      order: [['payment_date', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching supplier payments:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los pagos a proveedores',
      error: error.message
    });
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
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'first_name', 'last_name']
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Pago no encontrado'
      });
    }

    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el pago',
      error: error.message
    });
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
      bank_id,
      notes
    } = req.body;

    // Validate required fields
    if (!supplier_id || !payment_date || !payment_method || !amount || !currency) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: supplier_id, payment_date, payment_method, amount, currency'
      });
    }

    // Validate amount
    if (parseFloat(amount) <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'El monto debe ser mayor que cero'
      });
    }

    // Verify supplier exists
    const supplier = await Supplier.findByPk(supplier_id);
    if (!supplier) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    // If purchase_order_id is provided, verify it exists
    if (purchase_order_id) {
      const purchaseOrder = await PurchaseOrder.findByPk(purchase_order_id);
      if (!purchaseOrder) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Orden de compra no encontrada'
        });
      }

      // Verify purchase order belongs to the supplier
      if (purchaseOrder.supplier_id !== supplier_id) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'La orden de compra no pertenece al proveedor seleccionado'
        });
      }
    }

    // Generate payment number
    const payment_number = await generatePaymentNumber();

    // Create payment
    const payment = await SupplierPayment.create({
      payment_number,
      supplier_id,
      purchase_order_id: purchase_order_id || null,
      payment_date,
      payment_method,
      amount: parseFloat(amount),
      currency,
      reference: reference || null,
      bank_id: bank_id || null,
      notes: notes || null,
      created_by: req.user.id
    }, { transaction });

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
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Pago registrado exitosamente',
      data: createdPayment
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating supplier payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar el pago',
      error: error.message
    });
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
      notes
    } = req.body;

    // Find payment
    const payment = await SupplierPayment.findByPk(id);
    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pago no encontrado'
      });
    }

    // Validate amount if provided
    if (amount && parseFloat(amount) <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'El monto debe ser mayor que cero'
      });
    }

    // Update payment
    await payment.update({
      payment_date: payment_date || payment.payment_date,
      payment_method: payment_method || payment.payment_method,
      amount: amount ? parseFloat(amount) : payment.amount,
      currency: currency || payment.currency,
      reference: reference !== undefined ? reference : payment.reference,
      bank_id: bank_id !== undefined ? bank_id : payment.bank_id,
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
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'first_name', 'last_name']
        }
      ]
    });

    res.json({
      success: true,
      message: 'Pago actualizado exitosamente',
      data: updatedPayment
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating supplier payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el pago',
      error: error.message
    });
  }
};

/**
 * Delete (soft delete) a supplier payment
 * DELETE /api/supplier-payments/:id
 */
exports.deletePayment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    // Find payment
    const payment = await SupplierPayment.findByPk(id);
    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pago no encontrado'
      });
    }

    // Delete payment (hard delete for now, can be changed to soft delete)
    await payment.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: 'Pago eliminado exitosamente'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting supplier payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el pago',
      error: error.message
    });
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
        success: false,
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
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Error fetching payments by supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los pagos del proveedor',
      error: error.message
    });
  }
};

/**
 * Get payment statistics
 * GET /api/supplier-payments/stats
 */
exports.getPaymentStats = async (req, res) => {
  try {
    const { start_date, end_date, supplier_id } = req.query;

    const where = {};

    // Filter by date range
    if (start_date || end_date) {
      where.payment_date = {};
      if (start_date) {
        where.payment_date[Op.gte] = start_date;
      }
      if (end_date) {
        where.payment_date[Op.lte] = end_date;
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
      success: true,
      data: {
        total_payments: totalPayments,
        total_by_currency: totalByCurrency,
        payments_by_method: paymentsByMethod,
        recent_payments: recentPayments
      }
    });
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas de pagos',
      error: error.message
    });
  }
};
