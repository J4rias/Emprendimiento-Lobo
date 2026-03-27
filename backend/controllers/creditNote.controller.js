const {
  CreditNote,
  CreditNoteDetail,
  Sale,
  SaleDetail,
  Customer,
  Warehouse,
  Product,
  ProductPresentation,
  Batch,
  Inventory,
  InventoryMovement,
  User,
  sequelize
} = require('../models');
const { Op } = require('sequelize');

/**
 * Generate unique credit note number
 * Format: NC-YYYYMMDD-####
 */
const generateCreditNoteNumber = async () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const prefix = `NC-${dateStr}`;

  // Find the last credit note number for today
  const lastCreditNote = await CreditNote.findOne({
    where: {
      credit_note_number: {
        [Op.like]: `${prefix}%`
      }
    },
    order: [['credit_note_number', 'DESC']]
  });

  let sequence = 1;
  if (lastCreditNote) {
    const lastSequence = parseInt(lastCreditNote.credit_note_number.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `${prefix}-${String(sequence).padStart(4, '0')}`;
};

/**
 * Get all credit notes with filters
 * GET /api/credit-notes
 */
exports.getAllCreditNotes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      customer_id,
      status,
      start_date,
      end_date
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};

    // Search by credit note number
    if (search) {
      where.credit_note_number = { [Op.like]: `%${search}%` };
    }

    // Filter by customer
    if (customer_id) {
      where.customer_id = customer_id;
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by date range
    if (start_date || end_date) {
      where.credit_note_date = {};
      if (start_date) {
        where.credit_note_date[Op.gte] = start_date;
      }
      if (end_date) {
        where.credit_note_date[Op.lte] = end_date;
      }
    }

    // Query credit notes
    const { count, rows } = await CreditNote.findAndCountAll({
      where,
      include: [
        {
          model: Sale,
          as: 'sale',
          attributes: ['id', 'sale_number', 'sale_date', 'total']
        },
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'first_name', 'last_name', 'business_name', 'trade_name', 'type', 'email', 'phone']
        },
        {
          model: Warehouse,
          as: 'warehouse',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'first_name', 'last_name']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'username', 'first_name', 'last_name'],
          required: false
        }
      ],
      order: [['credit_note_date', 'DESC'], ['created_at', 'DESC']],
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
    console.error('Error fetching credit notes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las notas de crédito',
      error: error.message
    });
  }
};

/**
 * Get credit note by ID
 * GET /api/credit-notes/:id
 */
exports.getCreditNoteById = async (req, res) => {
  try {
    const { id } = req.params;

    const creditNote = await CreditNote.findByPk(id, {
      include: [
        {
          model: Sale,
          as: 'sale',
          attributes: ['id', 'sale_number', 'sale_date', 'total', 'payment_method']
        },
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'first_name', 'last_name', 'business_name', 'trade_name', 'type', 'email', 'phone', 'address']
        },
        {
          model: Warehouse,
          as: 'warehouse',
          attributes: ['id', 'name', 'address']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'first_name', 'last_name']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'username', 'first_name', 'last_name'],
          required: false
        },
        {
          model: CreditNoteDetail,
          as: 'details',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'sku']
            },
            {
              model: ProductPresentation,
              as: 'presentation',
              attributes: ['id', 'name', 'units_per_package']
            },
            {
              model: Batch,
              as: 'batch',
              attributes: ['id', 'batch_number', 'expiry_date'],
              required: false
            }
          ]
        }
      ]
    });

    if (!creditNote) {
      return res.status(404).json({
        success: false,
        message: 'Nota de crédito no encontrada'
      });
    }

    res.json({
      success: true,
      data: creditNote
    });
  } catch (error) {
    console.error('Error fetching credit note:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la nota de crédito',
      error: error.message
    });
  }
};

/**
 * Create a new credit note
 * POST /api/credit-notes
 */
exports.createCreditNote = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      sale_id,
      reason,
      reason_description,
      type,
      refund_method,
      refund_amount,
      refund_reference,
      notes,
      items // Array of { sale_detail_id, package_quantity_returned, loose_units_returned, return_to_stock }
    } = req.body;

    // Validate required fields
    if (!sale_id || !reason || !type || !items || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: sale_id, reason, type, items'
      });
    }

    // Verify sale exists
    const sale = await Sale.findByPk(sale_id, {
      include: [
        {
          model: SaleDetail,
          as: 'details',
          include: [
            {
              model: Product,
              as: 'product'
            },
            {
              model: ProductPresentation,
              as: 'presentation'
            }
          ]
        }
      ],
      transaction
    });

    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Venta no encontrada'
      });
    }

    // Validate refund method vs customer type
    if (refund_method === 'credit_balance' && !sale.customer_id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'El Consumidor Final no tiene monedero. Seleccione otro método de reembolso.'
      });
    }

    // Generate credit note number
    const credit_note_number = await generateCreditNoteNumber();

    // Calculate totals
    let subtotal = 0;
    let tax_amount = 0;
    const creditNoteDetails = [];

    for (const item of items) {
      const saleDetail = sale.details.find(d => d.id === item.sale_detail_id);

      if (!saleDetail) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Detalle de venta ${item.sale_detail_id} no encontrado en la venta`
        });
      }

      // Calculate total units returned
      const unitsReturned = (item.package_quantity_returned * saleDetail.presentation.units_per_package) + item.loose_units_returned;

      // Calculate total units sold
      const unitsSold = (saleDetail.package_quantity * saleDetail.presentation.units_per_package) + saleDetail.loose_units;

      // Validate that returned quantity doesn't exceed sold quantity
      if (unitsReturned > unitsSold) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `No puede devolver más unidades de las vendidas para ${saleDetail.product.name}`
        });
      }

      // Calculate line total
      const line_subtotal = saleDetail.unit_price * unitsReturned;
      const line_discount = line_subtotal * (saleDetail.discount_percent / 100);
      const line_tax = (line_subtotal - line_discount) * (saleDetail.tax_percent / 100);
      const line_total = line_subtotal - line_discount + line_tax;

      subtotal += line_subtotal - line_discount;
      tax_amount += line_tax;

      creditNoteDetails.push({
        sale_detail_id: item.sale_detail_id,
        product_id: saleDetail.product_id,
        presentation_id: saleDetail.presentation_id,
        batch_id: saleDetail.batch_id || null,
        package_quantity_returned: item.package_quantity_returned,
        loose_units_returned: item.loose_units_returned,
        unit_price: saleDetail.unit_price,
        discount_percent: saleDetail.discount_percent,
        tax_percent: saleDetail.tax_percent,
        line_total: line_total,
        return_to_stock: item.return_to_stock !== undefined ? item.return_to_stock : true
      });
    }

    const total = subtotal + tax_amount;

    // Create credit note
    const creditNote = await CreditNote.create({
      credit_note_number,
      sale_id,
      customer_id: sale.customer_id,
      warehouse_id: sale.warehouse_id,
      credit_note_date: new Date(),
      reason,
      reason_description: reason_description || null,
      type,
      status: 'draft',
      subtotal,
      tax_amount,
      total,
      refund_method: refund_method || 'none',
      refund_amount: refund_amount || (refund_method === 'credit_balance' ? total : 0),
      refund_reference: refund_reference || null,
      notes: notes || null,
      created_by: req.user.id
    }, { transaction });

    // Create credit note details
    for (const detail of creditNoteDetails) {
      await CreditNoteDetail.create({
        credit_note_id: creditNote.id,
        ...detail
      }, { transaction });
    }

    await transaction.commit();

    // Fetch complete credit note
    const createdCreditNote = await CreditNote.findByPk(creditNote.id, {
      include: [
        {
          model: Sale,
          as: 'sale',
          attributes: ['id', 'sale_number', 'sale_date', 'total']
        },
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'first_name', 'last_name', 'business_name', 'type', 'email']
        },
        {
          model: CreditNoteDetail,
          as: 'details',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name']
            },
            {
              model: ProductPresentation,
              as: 'presentation',
              attributes: ['id', 'name', 'units_per_package']
            }
          ]
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Nota de crédito creada exitosamente',
      data: createdCreditNote
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating credit note:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la nota de crédito',
      error: error.message
    });
  }
};

/**
 * Approve and apply a credit note
 * POST /api/credit-notes/:id/approve
 *
 * CRITICAL LOGIC:
 * - Return products to inventory if return_to_stock = true
 * - Update customer credit balance if refund_method = 'credit_balance'
 * - Update sale status if full return
 * - All within a transaction
 */
exports.approveCreditNote = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    // Find credit note
    const creditNote = await CreditNote.findByPk(id, {
      include: [
        {
          model: CreditNoteDetail,
          as: 'details',
          include: [
            {
              model: Product,
              as: 'product'
            },
            {
              model: ProductPresentation,
              as: 'presentation'
            }
          ]
        },
        {
          model: Sale,
          as: 'sale'
        },
        {
          model: Customer,
          as: 'customer'
        }
      ],
      transaction
    });

    if (!creditNote) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Nota de crédito no encontrada'
      });
    }

    // Validate status
    if (creditNote.status !== 'draft') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden aprobar notas de crédito en estado borrador'
      });
    }

    // Process each returned product
    for (const detail of creditNote.details) {
      if (detail.return_to_stock) {
        // Calculate total units to return
        const totalUnits = (detail.package_quantity_returned * detail.presentation.units_per_package) + detail.loose_units_returned;

        // Find or create inventory record
        let inventory = await Inventory.findOne({
          where: {
            product_id: detail.product_id,
            warehouse_id: creditNote.warehouse_id
          },
          transaction
        });

        if (!inventory) {
          inventory = await Inventory.create({
            product_id: detail.product_id,
            warehouse_id: creditNote.warehouse_id,
            quantity: 0
          }, { transaction });
        }

        // Update inventory - ADD returned quantity
        await inventory.update({
          quantity: parseInt(inventory.quantity) + totalUnits
        }, { transaction });

        // Create inventory movement record
        await InventoryMovement.create({
          product_id: detail.product_id,
          warehouse_id: creditNote.warehouse_id,
          presentation_id: detail.presentation_id,
          batch_id: detail.batch_id || null,
          type: 'ingreso',
          movement_type: 'ingreso',
          package_quantity: detail.package_quantity_returned,
          loose_units: detail.loose_units_returned,
          quantity: totalUnits,
          unit_cost: detail.unit_price,
          reference_type: 'credit_note',
          reference_id: creditNote.id,
          reference_number: creditNote.credit_note_number,
          notes: `Devolución de venta ${creditNote.sale.sale_number}`,
          user_id: req.user.id
        }, { transaction });

        // Update batch quantity if batch exists
        if (detail.batch_id) {
          const batch = await Batch.findByPk(detail.batch_id, { transaction });
          if (batch) {
            await batch.update({
              quantity: parseInt(batch.quantity) + totalUnits
            }, { transaction });
          }
        }
      }
    }

    // Update customer credit balance if refund method is credit_balance
    if (creditNote.refund_method === 'credit_balance' && creditNote.refund_amount > 0) {
      const customer = await Customer.findByPk(creditNote.customer_id, { transaction });
      if (customer) {
        // Add to customer's available credit
        const newCreditUsed = Math.max(0, parseFloat(customer.credit_used || 0) - parseFloat(creditNote.refund_amount));
        await customer.update({
          credit_used: newCreditUsed
        }, { transaction });
      }
    }

    // Update sale status if full return
    if (creditNote.type === 'full') {
      await Sale.update({
        status: 'returned'
      }, {
        where: { id: creditNote.sale_id },
        transaction
      });
    }

    // Update credit note status
    await creditNote.update({
      status: 'applied',
      approved_by: req.user.id,
      approved_at: new Date()
    }, { transaction });

    await transaction.commit();

    // Fetch updated credit note
    const updatedCreditNote = await CreditNote.findByPk(id, {
      include: [
        {
          model: Sale,
          as: 'sale',
          attributes: ['id', 'sale_number', 'sale_date', 'total']
        },
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'first_name', 'last_name', 'business_name', 'type', 'email']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'username', 'first_name', 'last_name']
        },
        {
          model: CreditNoteDetail,
          as: 'details',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name']
            },
            {
              model: ProductPresentation,
              as: 'presentation',
              attributes: ['id', 'name', 'units_per_package']
            }
          ]
        }
      ]
    });

    res.json({
      success: true,
      message: 'Nota de crédito aprobada y aplicada exitosamente',
      data: updatedCreditNote
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error approving credit note:', error);
    res.status(500).json({
      success: false,
      message: 'Error al aprobar la nota de crédito',
      error: error.message
    });
  }
};

/**
 * Cancel a credit note
 * POST /api/credit-notes/:id/cancel
 */
exports.cancelCreditNote = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    // Find credit note
    const creditNote = await CreditNote.findByPk(id, { transaction });

    if (!creditNote) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Nota de crédito no encontrada'
      });
    }

    // Validate status
    if (creditNote.status === 'cancelled') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'La nota de crédito ya está cancelada'
      });
    }

    if (creditNote.status === 'applied') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No se puede cancelar una nota de crédito que ya ha sido aplicada'
      });
    }

    // Update credit note
    await creditNote.update({
      status: 'cancelled',
      notes: creditNote.notes ? `${creditNote.notes}\n\nMotivo de cancelación: ${cancellation_reason}` : `Motivo de cancelación: ${cancellation_reason}`
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: 'Nota de crédito cancelada exitosamente'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error cancelling credit note:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar la nota de crédito',
      error: error.message
    });
  }
};

/**
 * Get credit note statistics
 * GET /api/credit-notes/stats
 */
exports.getCreditNoteStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const where = {};

    // Filter by date range
    if (start_date || end_date) {
      where.credit_note_date = {};
      if (start_date) {
        where.credit_note_date[Op.gte] = start_date;
      }
      if (end_date) {
        where.credit_note_date[Op.lte] = end_date;
      }
    }

    // Total credit notes
    const totalCreditNotes = await CreditNote.count({ where });

    // Credit notes by status
    const creditNotesByStatus = await CreditNote.findAll({
      where,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('total')), 'total_amount']
      ],
      group: ['status']
    });

    // Credit notes by reason
    const creditNotesByReason = await CreditNote.findAll({
      where,
      attributes: [
        'reason',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('total')), 'total_amount']
      ],
      group: ['reason']
    });

    // Total refunded amount
    const totalRefunded = await CreditNote.sum('refund_amount', {
      where: {
        ...where,
        status: 'applied'
      }
    });

    res.json({
      success: true,
      data: {
        total_credit_notes: totalCreditNotes,
        credit_notes_by_status: creditNotesByStatus,
        credit_notes_by_reason: creditNotesByReason,
        total_refunded: totalRefunded || 0
      }
    });
  } catch (error) {
    console.error('Error fetching credit note stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};
