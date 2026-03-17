const { Sale, SaleDetail, SalePayment, Product, ProductPresentation, Customer, Warehouse, User, Inventory, Batch, sequelize } = require('../models');
const { Op } = require('sequelize');

const generateSaleNumber = async () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  const prefix = `VEN-${year}${month}${day}`;

  const lastSale = await Sale.findOne({
    where: {
      sale_number: {
        [Op.like]: `${prefix}%`
      }
    },
    order: [['sale_number', 'DESC']]
  });

  let sequence = 1;
  if (lastSale) {
    const lastSequence = parseInt(lastSale.sale_number.split('-').pop());
    sequence = lastSequence + 1;
  }

  return `${prefix}-${String(sequence).padStart(4, '0')}`;
};

exports.createSale = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      customer_id,
      warehouse_id,
      sale_type,
      payment_lines = [],
      items,
      discount_amount = 0,
      notes,
      quote_id,
      exchange_rate = 1
    } = req.body;

    // Calculate total paid USD early
    let paid_amount = 0;
    if (sale_type === 'cash' && payment_lines.length > 0) {
      paid_amount = payment_lines.reduce((sum, line) => {
        const amount = parseFloat(line.amount) || 0;
        const rate = parseFloat(line.exchange_rate) || 1;
        // In POS the sum of (amount / rate) forms the USD equivalent
        return sum + (amount / rate);
      }, 0);
    }

    if (!items || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'La venta debe tener al menos un producto' });
    }

    if (!warehouse_id) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Debe especificar el depósito' });
    }

    const sale_number = await generateSaleNumber();

    let subtotal = 0;
    let tax_amount = 0;
    const saleDetails = [];

    for (const item of items) {
      const product = await Product.findByPk(item.product_id);
      if (!product) {
        await transaction.rollback();
        return res.status(404).json({ message: `Producto ${item.product_id} no encontrado` });
      }

      const presentation = await ProductPresentation.findByPk(item.presentation_id);
      if (!presentation) {
        await transaction.rollback();
        return res.status(404).json({ message: `Presentación ${item.presentation_id} no encontrada` });
      }

      const inventory = await Inventory.findOne({
        where: {
          product_id: item.product_id,
          warehouse_id: warehouse_id
        }
      });

      if (!inventory) {
        await transaction.rollback();
        return res.status(400).json({
          message: `No hay registro de inventario para ${product.name}`
        });
      }

      const unit_price = item.unit_price || presentation.base_price;
      const is_unit = item.is_unit || false;
      const item_subtotal = unit_price * item.quantity;
      const item_discount = item.discount_percent ? (item_subtotal * item.discount_percent / 100) : 0;
      const taxable_amount = item_subtotal - item_discount;
      const item_tax = taxable_amount * (item.tax_percent || 0) / 100;
      const item_total = taxable_amount + item_tax;

      subtotal += item_subtotal;
      tax_amount += item_tax;

      // Calculate base units for inventory deduction
      // If sold as package, multiply quantity by units_per_package
      const units_to_deduct = is_unit ? item.quantity : (item.quantity * (presentation.units_per_package || 1));

      // Cash: check physical stock (quantity). Credit: check available (quantity - reserved).
      const stockToCheck = sale_type === 'cash'
        ? parseFloat(inventory.quantity)
        : inventory.available_quantity;

      if (stockToCheck < units_to_deduct) {
        await transaction.rollback();
        return res.status(400).json({
          message: `Stock insuficiente para ${product.name}. Disponible: ${Math.floor(stockToCheck)}`
        });
      }

      saleDetails.push({
        product_id: item.product_id,
        presentation_id: item.presentation_id,
        batch_id: item.batch_id || null,
        quantity: item.quantity,
        is_unit: is_unit,
        unit_price: unit_price,
        discount_percent: item.discount_percent || 0,
        discount_amount: item_discount,
        tax_percent: item.tax_percent || 0,
        tax_amount: item_tax,
        subtotal: item_subtotal,
        total: item_total,
        cost_price: presentation.cost_price,
        notes: item.notes || null
      });

      if (sale_type === 'cash') {
        // Cash sale is immediately completed: reduce physical stock
        await inventory.update({
          quantity: parseFloat(inventory.quantity) - units_to_deduct
        }, { transaction });
      } else {
        // Credit sale: reserve until payment is collected
        await inventory.update({
          reserved_quantity: parseFloat(inventory.reserved_quantity) + units_to_deduct
        }, { transaction });
      }
    }

    const total = subtotal - discount_amount + tax_amount;
    const change_amount = sale_type === 'cash' ? Math.max(0, paid_amount - total) : 0;

    // For credit sales, update the customer's credit_used
    // Credit validation (in COP) is already handled by the frontend before reaching here
    if (sale_type === 'credit' && customer_id) {
      const customer = await Customer.findByPk(customer_id, { transaction });

      if (!customer) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      // Accumulate the sale total (USD) to credit_used
      const currentCreditUsed = parseFloat(customer.credit_used || 0);
      await customer.update({
        credit_used: currentCreditUsed + total
      }, { transaction });
    }

    const sale = await Sale.create({
      sale_number,
      customer_id: customer_id || null,
      warehouse_id,
      user_id: req.user.id,
      sale_date: new Date(),
      sale_type,
      exchange_rate,
      payment_method: sale_type === 'cash' && payment_lines.length > 0 ? payment_lines[0].method : null,
      subtotal,
      tax_amount,
      discount_amount,
      total,
      paid_amount: sale_type === 'cash' ? paid_amount : 0,
      change_amount,
      status: sale_type === 'cash' ? 'completed' : 'pending',
      notes,
      quote_id: quote_id || null,
      created_by: req.user.id
    }, { transaction });

    for (const detail of saleDetails) {
      await SaleDetail.create({
        sale_id: sale.id,
        ...detail
      }, { transaction });
    }

    if (sale_type === 'cash' && payment_lines.length > 0) {
      for (const payLine of payment_lines) {
        if (parseFloat(payLine.amount) > 0) {
          await SalePayment.create({
            sale_id: sale.id,
            payment_date: new Date(),
            payment_method: payLine.method || 'cash',
            amount: payLine.amount,
            currency: payLine.currency || 'USD',
            exchange_rate: payLine.exchange_rate || 1,
            reference: payLine.reference || null,
            created_by: req.user.id
          }, { transaction });

          // If payment is via credit_balance, deduct it from Customer
          if (payLine.method === 'credit_balance' && customer_id) {
            const customer = await Customer.findByPk(customer_id, { transaction });
            if (customer) {
              // The payment amount is in the specified currency, we need to deduct the equivalent in the Customer's base currency (always USD for balance in this system)
              const amountUSD = parseFloat(payLine.amount) / (parseFloat(payLine.exchange_rate) || 1);
              const currentBalance = parseFloat(customer.creditBalance || 0);
              const newBalance = Math.max(0, currentBalance - amountUSD);
              await customer.update({ creditBalance: newBalance }, { transaction });
            }
          }
        }
      }
    }

    await transaction.commit();

    const createdSale = await Sale.findByPk(sale.id, {
      include: [
        {
          model: SaleDetail,
          as: 'details',
          include: [
            { model: Product, as: 'product' },
            { model: ProductPresentation, as: 'presentation' }
          ]
        },
        { model: Customer, as: 'customer' },
        { model: Warehouse, as: 'warehouse' },
        { model: User, as: 'seller' }
      ]
    });

    res.status(201).json({
      message: 'Venta creada exitosamente',
      sale: createdSale
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error creating sale:', error);
    res.status(500).json({
      message: 'Error al crear la venta',
      error: error.message
    });
  }
};

exports.getSales = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      sale_type,
      customer_id,
      warehouse_id,
      start_date,
      end_date
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    if (search) {
      where.sale_number = { [Op.like]: `%${search}%` };
    }

    if (status) {
      where.status = status;
    }

    if (sale_type) {
      where.sale_type = sale_type;
    }

    if (customer_id) {
      where.customer_id = customer_id;
    }

    if (warehouse_id) {
      where.warehouse_id = warehouse_id;
    }

    if (start_date && end_date) {
      where.sale_date = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    } else if (start_date) {
      where.sale_date = {
        [Op.gte]: new Date(start_date)
      };
    } else if (end_date) {
      where.sale_date = {
        [Op.lte]: new Date(end_date)
      };
    }

    const { count, rows } = await Sale.findAndCountAll({
      where,
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'firstName', 'lastName', 'businessName', 'type', 'documentNumber']
        },
        {
          model: Warehouse,
          as: 'warehouse',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'seller',
          attributes: ['id', 'username', 'first_name', 'last_name']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['sale_date', 'DESC']]
    });

    res.json({
      sales: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({
      message: 'Error al obtener las ventas',
      error: error.message
    });
  }
};

exports.getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await Sale.findByPk(id, {
      include: [
        {
          model: SaleDetail,
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
              attributes: ['id', 'name']
            },
            {
              model: Batch,
              as: 'batch',
              attributes: ['id', 'batch_number', 'expiration_date']
            }
          ]
        },
        {
          model: Customer,
          as: 'customer'
        },
        {
          model: Warehouse,
          as: 'warehouse'
        },
        {
          model: User,
          as: 'seller',
          attributes: ['id', 'username', 'first_name', 'last_name']
        },
        {
          model: SalePayment,
          as: 'payments',
          include: [
            {
              model: User,
              as: 'creator',
              attributes: ['id', 'username', 'first_name', 'last_name']
            }
          ]
        }
      ]
    });

    if (!sale) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    res.json({ sale });

  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({
      message: 'Error al obtener la venta',
      error: error.message
    });
  }
};

exports.updateSale = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const sale = await Sale.findByPk(id);

    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    if (sale.status === 'completed' || sale.status === 'cancelled') {
      await transaction.rollback();
      return res.status(400).json({
        message: 'No se puede modificar una venta completada o cancelada'
      });
    }

    await sale.update({
      status: status || sale.status,
      notes: notes !== undefined ? notes : sale.notes,
      updated_by: req.user.id
    }, { transaction });

    await transaction.commit();

    const updatedSale = await Sale.findByPk(id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: Warehouse, as: 'warehouse' },
        { model: User, as: 'seller' }
      ]
    });

    res.json({
      message: 'Venta actualizada exitosamente',
      sale: updatedSale
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error updating sale:', error);
    res.status(500).json({
      message: 'Error al actualizar la venta',
      error: error.message
    });
  }
};

exports.cancelSale = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    const sale = await Sale.findByPk(id, {
      include: [{
        model: SaleDetail,
        as: 'details',
        include: [{ model: ProductPresentation, as: 'presentation' }]
      }]
    });

    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    if (sale.status === 'cancelled') {
      await transaction.rollback();
      return res.status(400).json({ message: 'La venta ya está cancelada' });
    }

    for (const detail of sale.details) {
      const inventory = await Inventory.findOne({
        where: {
          product_id: detail.product_id,
          warehouse_id: sale.warehouse_id
        }
      });

      if (inventory) {
        const units_to_return = detail.is_unit ? parseFloat(detail.quantity) : (parseFloat(detail.quantity) * (detail.presentation?.units_per_package || 1));

        if (sale.status === 'completed') {
          // Restore physical stock
          await inventory.update({
            quantity: parseFloat(inventory.quantity) + units_to_return
          }, { transaction });
        } else if (sale.status === 'pending') {
          // Release reservation (quantity was never deducted for credit sales)
          await inventory.update({
            reserved_quantity: parseFloat(inventory.reserved_quantity) - units_to_return
          }, { transaction });
        }
      }
    }

    await sale.update({
      status: 'cancelled',
      notes: `${sale.notes || ''}\nCANCELADA: ${reason || 'Sin razón especificada'}`,
      updated_by: req.user.id
    }, { transaction });

    await transaction.commit();

    res.json({
      message: 'Venta cancelada exitosamente',
      sale
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error cancelling sale:', error);
    res.status(500).json({
      message: 'Error al cancelar la venta',
      error: error.message
    });
  }
};

exports.addPayment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { payment_lines = [], notes } = req.body; // Adapt to new multi-payment support

    const sale = await Sale.findByPk(id);

    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    if (sale.sale_type !== 'credit') {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Solo se pueden agregar pagos a ventas a crédito'
      });
    }

    if (sale.status === 'cancelled') {
      await transaction.rollback();
      return res.status(400).json({
        message: 'No se pueden agregar pagos a una venta cancelada'
      });
    }

    if (!payment_lines || payment_lines.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'No se enviaron líneas de pago' });
    }

    let newlyPaidUSD = 0;
    const createdPayments = [];

    for (const payLine of payment_lines) {
      const amountUSD = (parseFloat(payLine.amount) || 0) / (parseFloat(payLine.exchange_rate) || 1);
      newlyPaidUSD += amountUSD;

      const payment = await SalePayment.create({
        sale_id: sale.id,
        payment_date: new Date(),
        payment_method: payLine.method || 'cash',
        amount: payLine.amount,
        currency: payLine.currency || 'USD',
        exchange_rate: payLine.exchange_rate || 1,
        reference: payLine.reference || null,
        notes: notes || null,
        created_by: req.user.id
      }, { transaction });

      createdPayments.push(payment);
    }

    const newPaidAmount = parseFloat(sale.paid_amount) + newlyPaidUSD;
    const newStatus = newPaidAmount >= parseFloat(sale.total) - 0.01 ? 'completed' : 'pending';

    await sale.update({
      paid_amount: newPaidAmount,
      status: newStatus,
      updated_by: req.user.id
    }, { transaction });

    if (newStatus === 'completed') {
      const saleDetails = await SaleDetail.findAll({
        where: { sale_id: sale.id },
        include: [{ model: ProductPresentation, as: 'presentation' }]
      });

      for (const detail of saleDetails) {
        const inventory = await Inventory.findOne({
          where: {
            product_id: detail.product_id,
            warehouse_id: sale.warehouse_id
          }
        });

        if (inventory) {
          const units_to_unreserve = detail.is_unit ? parseFloat(detail.quantity) : (parseFloat(detail.quantity) * (detail.presentation?.units_per_package || 1));
          await inventory.update({
            quantity: parseFloat(inventory.quantity) - units_to_unreserve,
            reserved_quantity: parseFloat(inventory.reserved_quantity) - units_to_unreserve
          }, { transaction });
        }
      }
    }

    // Update customer's credit_used to restore available credit
    if (sale.customer_id) {
      const customer = await Customer.findByPk(sale.customer_id, { transaction });
      if (customer) {
        const currentCreditUsed = parseFloat(customer.credit_used || 0);
        // Ensure credit_used doesn't drop below 0 due to rounding
        const updatedCreditUsed = Math.max(0, currentCreditUsed - newlyPaidUSD);
        await customer.update({ credit_used: updatedCreditUsed }, { transaction });
      }
    }

    await transaction.commit();

    const updatedSale = await Sale.findByPk(id, {
      include: [
        { model: SalePayment, as: 'payments' }
      ]
    });

    res.json({
      message: 'Pagos registrados exitosamente',
      payments: createdPayments,
      sale: updatedSale
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error adding payment:', error);
    res.status(500).json({
      message: 'Error al registrar el pago',
      error: error.message
    });
  }
};

exports.getSalesStats = async (req, res) => {
  try {
    const { start_date, end_date, warehouse_id } = req.query;

    const where = {};

    if (start_date && end_date) {
      where.sale_date = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    }

    if (warehouse_id) {
      where.warehouse_id = warehouse_id;
    }

    const totalSales = await Sale.count({ where });

    const totalRevenue = await Sale.sum('total', {
      where: {
        ...where,
        status: { [Op.in]: ['completed', 'pending'] }
      }
    });

    const salesByType = await Sale.findAll({
      where,
      attributes: [
        'sale_type',
        [sequelize.fn('COUNT', sequelize.col('Sale.id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('Sale.total')), 'total']
      ],
      group: ['sale_type']
    });

    const salesByStatus = await Sale.findAll({
      where,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('Sale.id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('Sale.total')), 'total']
      ],
      group: ['status']
    });

    const topProducts = await SaleDetail.findAll({
      attributes: [
        'product_id',
        [sequelize.fn('SUM', sequelize.col('SaleDetail.quantity')), 'total_quantity'],
        [sequelize.fn('SUM', sequelize.col('SaleDetail.total')), 'total_amount']
      ],
      include: [
        {
          model: Sale,
          as: 'sale',
          where,
          attributes: []
        },
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'sku']
        }
      ],
      group: ['SaleDetail.product_id', 'product.id', 'product.name', 'product.sku'],
      order: [[sequelize.fn('SUM', sequelize.col('SaleDetail.quantity')), 'DESC']],
      limit: 10,
      raw: false
    });

    res.json({
      stats: {
        totalSales,
        totalRevenue: totalRevenue || 0,
        salesByType,
        salesByStatus,
        topProducts
      }
    });

  } catch (error) {
    console.error('Error fetching sales stats:', error);
    res.status(500).json({
      message: 'Error al obtener estadísticas de ventas',
      error: error.message
    });
  }
};

exports.getDailyClosure = async (req, res) => {
  try {
    const { date, user_id } = req.query;

    // Default to today in local timezone if not provided
    let targetDate = new Date();
    if (date) {
      targetDate = new Date(date);
    }

    // Set start and end of the day for the query
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const where = {
      sale_date: {
        [Op.between]: [startOfDay, endOfDay]
      },
      status: { [Op.in]: ['completed', 'pending'] } // Assuming only non-cancelled sales count for closure
    };

    if (user_id) {
      where.user_id = user_id;
    }

    // 1. Fetch total sales base (USD) amount and count
    const totalSalesUSD = await Sale.sum('total', { where }) || 0;
    const salesCount = await Sale.count({ where });

    // 2. Fetch all sales IDs to get their payments
    const sales = await Sale.findAll({
      where,
      attributes: ['id']
    });

    const saleIds = sales.map(s => s.id);

    // 3. Aggregate payments by Currency and Method
    // We want to sum the literal 'amount' paid in that currency
    const paymentsBreakdown = {};

    if (saleIds.length > 0) {
      const payments = await SalePayment.findAll({
        where: { sale_id: { [Op.in]: saleIds } },
        attributes: [
          'currency',
          'method',
          [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
        ],
        group: ['currency', 'method'],
        raw: true
      });

      // Format output into a clean nested object: { "COP": { "cash": 50000, "transfer": 200 }, "USD": ... }
      payments.forEach(p => {
        const curr = p.currency || 'USD';
        const method = p.method;
        const total = parseFloat(p.total_amount) || 0;

        if (!paymentsBreakdown[curr]) {
          paymentsBreakdown[curr] = {};
        }
        paymentsBreakdown[curr][method] = total;
      });
    }

    res.json({
      date: startOfDay.toISOString().split('T')[0],
      totalSalesUSD,
      salesCount,
      paymentsBreakdown
    });

  } catch (error) {
    console.error('Error generating daily closure:', error);
    res.status(500).json({
      message: 'Error al generar el cierre de caja',
      error: error.message
    });
  }
};
