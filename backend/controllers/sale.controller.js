const { Sale, SaleDetail, SalePayment, Product, ProductPresentation, Customer, Warehouse, User, Inventory, Batch, PosReservation, Role, sequelize } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

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
      currency_mode = 'COP',
      payment_lines = [],
      items,
      discount_amount = 0,
      notes,
      quote_id,
      exchange_rate = 1,
      authorized_by
    } = req.body;

    // Credit/mixed sales: non-admin users require admin authorization
    if (sale_type === 'credit' || sale_type === 'mixed') {
      const isAdmin = req.user.role?.name === 'Administrador';
      if (!isAdmin && !authorized_by) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: 'Venta a crédito requiere autorización de un administrador'
        });
      }
    }

    // Separate credit lines from cash/card/transfer lines
    const cashLines = payment_lines.filter(l => l.method !== 'credit');
    const creditLines = payment_lines.filter(l => l.method === 'credit');

    // Calculate total paid USD (excluding credit lines)
    let paid_amount = 0;
    if ((sale_type === 'cash' || sale_type === 'mixed') && cashLines.length > 0) {
      paid_amount = cashLines.reduce((sum, line) => {
        const amount = parseFloat(line.amount) || 0;
        const rate = parseFloat(line.exchange_rate) || 1;
        return sum + (amount / rate);
      }, 0);
    }

    // Calculate credit amount (USD equivalent of credit lines)
    let credit_amount = 0;
    if ((sale_type === 'credit' || sale_type === 'mixed') && creditLines.length > 0) {
      credit_amount = creditLines.reduce((sum, line) => {
        const amount = parseFloat(line.amount) || 0;
        const rate = parseFloat(line.exchange_rate) || 1;
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

    // Extract POS session info once (used inside loop and after commit)
    const session_id = req.body.session_id;
    const tab_id = req.body.tab_id;

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
        },
        lock: transaction.LOCK.UPDATE,  // SELECT FOR UPDATE (bloqueo de fila)
        transaction                     // ← necesario para que el lock sea parte de la transacción
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

      // Validar disponibilidad considerando reservas de OTROS tabs
      // (las reservas de ESTA tab se liberarán al finalizar la venta)
      // NOT (session_id = A AND tab_id = B)  ≡  (session_id != A  OR  tab_id != B)
      let reserved_by_others = 0;
      if (session_id && tab_id) {
        reserved_by_others = await PosReservation.sum('units_reserved', {
          where: {
            product_id: item.product_id,
            [Op.or]: [
              { session_id: { [Op.ne]: session_id } },
              { tab_id: { [Op.ne]: tab_id } }
            ]
          },
          transaction
        }) || 0;
      }

      const available = parseFloat(inventory.quantity) - parseFloat(reserved_by_others);

      if (available < units_to_deduct) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          conflict: true,
          message: `Stock insuficiente para ${product.name}. Otro vendedor reservó parte del stock.`,
          product_name: product.name,
          available: Math.max(0, available),
          requested: units_to_deduct,
          reserved_by_others: parseFloat(reserved_by_others)
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

      // Both cash and credit reduce physical stock immediately (goods leave warehouse on sale)
      await inventory.update({
        quantity: parseFloat(inventory.quantity) - units_to_deduct
      }, { transaction });
    }

    const total = subtotal - discount_amount + tax_amount;
    const change_amount = sale_type === 'cash' ? Math.max(0, paid_amount - total) : 0;

    // For credit/mixed sales: credit_amount is either the full total (credit) or the credit lines (mixed)
    if (sale_type === 'credit') {
      credit_amount = total;
    }

    // Update customer's credit_used for sales with credit component
    if ((sale_type === 'credit' || sale_type === 'mixed') && customer_id && credit_amount > 0) {
      const customer = await Customer.findByPk(customer_id, { transaction });

      if (!customer) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }

      const currentCreditUsed = parseFloat(customer.credit_used || 0);
      await customer.update({
        credit_used: currentCreditUsed + credit_amount
      }, { transaction });
    }

    const sale = await Sale.create({
      sale_number,
      customer_id: customer_id || null,
      warehouse_id,
      user_id: req.user.id,
      sale_date: new Date(),
      sale_type,
      currency_mode,
      exchange_rate,
      payment_method: sale_type === 'cash' && cashLines.length > 0 ? cashLines[0].method : null,
      subtotal,
      tax_amount,
      discount_amount,
      total,
      credit_amount,
      paid_amount: (sale_type === 'cash' || sale_type === 'mixed') ? paid_amount : 0,
      change_amount,
      status: sale_type === 'cash' ? 'completed' : 'pending',
      notes,
      quote_id: quote_id || null,
      created_by: req.user.id,
      authorized_by: (sale_type === 'credit' || sale_type === 'mixed')
        ? (req.user.role?.name === 'Administrador' ? req.user.id : authorized_by)
        : null
    }, { transaction });

    for (const detail of saleDetails) {
      await SaleDetail.create({
        sale_id: sale.id,
        ...detail
      }, { transaction });
    }

    if ((sale_type === 'cash' || sale_type === 'mixed') && cashLines.length > 0) {
      for (const payLine of cashLines) {
        if (parseFloat(payLine.amount) !== 0) {
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

    // Release POS reservations for this tab (session_id and tab_id declared above the for loop)
    const affected_product_ids = [];

    if (session_id && tab_id) {
      // Get all products affected by this tab's reservations
      const reservations = await PosReservation.findAll({
        where: { session_id, tab_id },
        attributes: ['product_id']
      });

      affected_product_ids.push(...reservations.map(r => r.product_id));

      // Delete all reservations for this tab
      await PosReservation.destroy({
        where: { session_id, tab_id }
      });

      // Emit Socket.io event to notify clients
      const io = req.app.get('io');
      if (io) {
        for (const product_id of affected_product_ids) {
          const totalReserved = await PosReservation.sum('units_reserved', {
            where: { product_id }
          }) || 0;

          io.to('pos-room').emit('reservation:changed', {
            product_id,
            total_reserved: totalReserved,
            action: 'sale_completed'
          });
        }
      }
    }

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
      where[Op.or] = [
        { sale_number: { [Op.like]: `%${search}%` } },
        { '$customer.first_name$': { [Op.like]: `%${search}%` } },
        { '$customer.last_name$': { [Op.like]: `%${search}%` } },
        { '$customer.business_name$': { [Op.like]: `%${search}%` } },
        { '$customer.document_number$': { [Op.like]: `%${search}%` } }
      ];
    }

    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      where.status = statuses.length === 1 ? statuses[0] : { [Op.in]: statuses };
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
      order: [['sale_date', 'DESC']],
      subQuery: false
    });

    // Fetch credit-note aggregates for the returned sale IDs in a single query
    const saleIds = rows.map(r => r.id);
    let cnAggMap = {};
    if (saleIds.length > 0) {
      const cnAgg = await sequelize.query(
        `SELECT sale_id,
                COUNT(*) AS cn_count,
                COALESCE(SUM(total * exchange_rate), 0) AS cn_total_cop
         FROM credit_notes
         WHERE sale_id IN (:saleIds)
           AND status IN ('approved', 'applied')
         GROUP BY sale_id`,
        { replacements: { saleIds }, type: sequelize.QueryTypes.SELECT }
      );
      for (const row of cnAgg) {
        cnAggMap[row.sale_id] = { cn_count: parseInt(row.cn_count), cn_total_cop: parseFloat(row.cn_total_cop) };
      }
    }

    const salesWithCN = rows.map(r => ({
      ...r.toJSON(),
      cn_count: cnAggMap[r.id]?.cn_count || 0,
      cn_total_cop: cnAggMap[r.id]?.cn_total_cop || 0
    }));

    res.json({
      sales: salesWithCN,
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

exports.getSaleBySaleNumber = async (req, res) => {
  try {
    const { saleNumber } = req.params;

    const sale = await Sale.findOne({
      where: { sale_number: saleNumber },
      include: [
        {
          model: SaleDetail,
          as: 'details',
          include: [
            { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
            { model: ProductPresentation, as: 'presentation', attributes: ['id', 'name'] },
            { model: Batch, as: 'batch', attributes: ['id', 'batch_number', 'expiration_date'] }
          ]
        },
        { model: Customer, as: 'customer' },
        { model: Warehouse, as: 'warehouse' },
        { model: User, as: 'seller', attributes: ['id', 'username', 'first_name', 'last_name'] },
        {
          model: SalePayment,
          as: 'payments',
          include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'first_name', 'last_name'] }]
        }
      ]
    });

    if (!sale) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    res.json({ data: sale });

  } catch (error) {
    console.error('Error fetching sale by number:', error);
    res.status(500).json({ message: 'Error al obtener la venta', error: error.message });
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

        if (sale.status === 'completed' || sale.status === 'pending' || sale.status === 'partial') {
          // Restore physical stock (goods return to warehouse on cancellation)
          await inventory.update({
            quantity: parseFloat(inventory.quantity) + units_to_return
          }, { transaction });
        }
      }
    }

    // Revert customer credit_used for credit/mixed sales
    if ((sale.sale_type === 'credit' || sale.sale_type === 'mixed') && sale.customer_id) {
      const customer = await Customer.findByPk(sale.customer_id, { transaction });
      if (customer) {
        const currentCreditUsed = parseFloat(customer.credit_used || 0);
        const creditToRevert = sale.sale_type === 'credit'
          ? parseFloat(sale.total)
          : parseFloat(sale.credit_amount || 0);
        await customer.update({
          credit_used: Math.max(0, currentCreditUsed - creditToRevert)
        }, { transaction });
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

    if (!['credit', 'mixed'].includes(sale.sale_type)) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Solo se pueden agregar pagos a ventas a crédito o mixtas'
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

      // If payment is via credit_balance, deduct it from Customer
      if (payLine.method === 'credit_balance' && sale.customer_id) {
        const customer = await Customer.findByPk(sale.customer_id, { transaction });
        if (customer) {
          const amountUSD = (parseFloat(payLine.amount) || 0) / (parseFloat(payLine.exchange_rate) || 1);
          const newBalance = Math.max(0, parseFloat(customer.creditBalance || 0) - amountUSD);
          await customer.update({ creditBalance: newBalance }, { transaction });
        }
      }
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

        // No inventory change needed: stock was already reduced when the credit sale was created
        void inventory;
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
    const { start_date, end_date, warehouse_id, summary_only } = req.query;

    const where = {};

    if (start_date && end_date) {
      where.sale_date = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    } else if (start_date) {
      where.sale_date = {
        [Op.gte]: new Date(start_date)
      };
    }

    if (warehouse_id) {
      where.warehouse_id = warehouse_id;
    }

    const totalSales = await Sale.count({
      where: { ...where, status: { [Op.in]: ['completed', 'pending'] } }
    });

    const totalRevenue = await Sale.sum('total', {
      where: {
        ...where,
        status: { [Op.in]: ['completed', 'pending'] }
      }
    });

    // COP total: each sale's total multiplied by its own historical exchange_rate
    const copResult = await Sale.findAll({
      where: { ...where, status: { [Op.in]: ['completed', 'pending'] } },
      attributes: [[sequelize.fn('SUM', sequelize.literal('total * exchange_rate')), 'total_cop']],
      raw: true
    });
    const totalRevenueCOP = Math.round(parseFloat(copResult[0]?.total_cop || 0));

    // summary_only skips heavy queries (topProducts, salesByType, salesByStatus, salesByCurrency)
    if (summary_only === 'true') {
      return res.json({
        stats: { totalSales, totalRevenue: totalRevenue || 0, totalRevenueCOP }
      });
    }

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
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN `SaleDetail`.`is_unit` = 1 THEN `SaleDetail`.`quantity` ELSE `SaleDetail`.`quantity` * `presentation`.`units_per_package` END')), 'total_quantity'],
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
        },
        {
          model: ProductPresentation,
          as: 'presentation',
          attributes: []
        }
      ],
      group: ['SaleDetail.product_id', 'product.id', 'product.name', 'product.sku'],
      order: [[sequelize.fn('SUM', sequelize.literal('CASE WHEN `SaleDetail`.`is_unit` = 1 THEN `SaleDetail`.`quantity` ELSE `SaleDetail`.`quantity` * `presentation`.`units_per_package` END')), 'DESC']],
      limit: parseInt(req.query.top_limit) || 10,
      raw: false
    });

    // Sales count and total by currency
    let salesByCurrency = {};
    if (totalSales > 0) {
      try {
        const statusWhere = { ...where, status: { [Op.in]: ['completed', 'pending'] } };
        const saleIds = (await Sale.findAll({ where: statusWhere, attributes: ['id'], raw: true })).map(s => s.id);
        if (saleIds.length > 0) {
          const currRows = await SalePayment.findAll({
            where: { sale_id: { [Op.in]: saleIds } },
            attributes: [
              'currency',
              [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('sale_id'))), 'sale_count'],
              [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
            ],
            group: ['currency'],
            raw: true
          });
          currRows.forEach(r => {
            salesByCurrency[r.currency || 'USD'] = {
              count: parseInt(r.sale_count) || 0,
              total: parseFloat(r.total_amount) || 0
            };
          });
        }
      } catch (e) {
        console.error('Error fetching salesByCurrency:', e.message);
      }
    }

    res.json({
      stats: {
        totalSales,
        totalRevenue: totalRevenue || 0,
        totalRevenueCOP,
        salesByType,
        salesByStatus,
        topProducts,
        salesByCurrency
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

exports.getProductSales = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const where = {
      status: { [Op.in]: ['completed', 'pending'] }
    };

    if (start_date && end_date) {
      where.sale_date = { [Op.between]: [new Date(start_date), new Date(end_date)] };
    } else if (start_date) {
      where.sale_date = { [Op.gte]: new Date(start_date) };
    }

    const productSales = await SaleDetail.findAll({
      attributes: [
        'product_id',
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN `SaleDetail`.`is_unit` = 1 THEN `SaleDetail`.`quantity` ELSE `SaleDetail`.`quantity` * `presentation`.`units_per_package` END')), 'total_quantity'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('SaleDetail.sale_id'))), 'num_sales'],
        [sequelize.fn('SUM', sequelize.col('SaleDetail.total')), 'total_usd'],
        [sequelize.fn('SUM', sequelize.literal('`SaleDetail`.`total` * `sale`.`exchange_rate`')), 'total_cop']
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
        },
        {
          model: ProductPresentation,
          as: 'presentation',
          attributes: []
        }
      ],
      group: ['SaleDetail.product_id', 'product.id', 'product.name', 'product.sku'],
      order: [[sequelize.fn('SUM', sequelize.col('SaleDetail.total')), 'DESC']],
      raw: false
    });

    res.json({ data: productSales, count: productSales.length });
  } catch (error) {
    console.error('Error fetching product sales:', error);
    res.status(500).json({
      message: 'Error al obtener ventas por producto',
      error: error.message
    });
  }
};

exports.getDailyClosure = async (req, res) => {
  try {
    const { date, user_id } = req.query;

    // Parse date in local timezone (new Date('YYYY-MM-DD') parses as UTC, causing off-by-one)
    let targetDate;
    if (date) {
      const [y, m, d] = date.split('-').map(Number);
      targetDate = new Date(y, m - 1, d);
    } else {
      targetDate = new Date();
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // === SALES STATS (by sale_date) ===
    const salesWhere = {
      sale_date: { [Op.between]: [startOfDay, endOfDay] },
      status: { [Op.in]: ['completed', 'pending'] }
    };
    if (user_id) salesWhere.user_id = user_id;

    const totalSalesUSD = await Sale.sum('total', { where: salesWhere }) || 0;
    const copResult = await Sale.findOne({
      where: salesWhere,
      attributes: [[sequelize.literal('SUM(total * exchange_rate)'), 'totalCOP']],
      raw: true
    });
    const totalSalesCOP = parseFloat(copResult?.totalCOP) || 0;
    const salesCount = await Sale.count({ where: salesWhere });

    // Credit extended today (total - paid_amount for credit/mixed sales)
    const creditResult = await Sale.findOne({
      where: { ...salesWhere, sale_type: { [Op.in]: ['credit', 'mixed'] } },
      attributes: [[sequelize.literal('SUM(total - paid_amount)'), 'creditTotal']],
      raw: true
    });
    const creditTotalUSD = parseFloat(creditResult?.creditTotal) || 0;

    // === PAYMENTS BREAKDOWN (only today's cash/mixed sales, not credit sales) ===
    const todaySaleIds = (await Sale.findAll({
      where: { ...salesWhere, sale_type: { [Op.in]: ['cash', 'mixed'] } },
      attributes: ['id']
    })).map(s => s.id);

    const paymentsBreakdown = {};

    if (todaySaleIds.length > 0) {
      const paymentWhere = {
        payment_date: { [Op.between]: [startOfDay, endOfDay] },
        sale_id: { [Op.in]: todaySaleIds }
      };
      if (user_id) paymentWhere.created_by = user_id;

      const payments = await SalePayment.findAll({
        where: paymentWhere,
        attributes: [
          'currency',
          'payment_method',
          [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount']
        ],
        group: ['currency', 'payment_method'],
        raw: true
      });

      payments.forEach(p => {
        const curr = p.currency || 'USD';
        const method = p.payment_method;
        const total = parseFloat(p.total_amount) || 0;
        if (!paymentsBreakdown[curr]) paymentsBreakdown[curr] = {};
        paymentsBreakdown[curr][method] = total;
      });

      const salesByCurrency = await SalePayment.findAll({
        where: paymentWhere,
        attributes: [
          'currency',
          [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('sale_id'))), 'sale_count']
        ],
        group: ['currency'],
        raw: true
      });

      salesByCurrency.forEach(r => {
        const curr = r.currency || 'USD';
        if (paymentsBreakdown[curr]) {
          paymentsBreakdown[curr]._salesCount = parseInt(r.sale_count) || 0;
        }
      });
    }

    // === CREDIT COLLECTIONS (payments today for old credit/mixed sales) ===
    const creditCollectionWhere = {
      payment_date: { [Op.between]: [startOfDay, endOfDay] }
    };
    if (user_id) creditCollectionWhere.created_by = user_id;

    const creditCollections = await SalePayment.findAll({
      where: creditCollectionWhere,
      include: [{
        model: Sale,
        as: 'sale',
        where: {
          [Op.or]: [
            { sale_type: 'credit' },
            { sale_date: { [Op.lt]: startOfDay }, sale_type: 'mixed' }
          ]
        },
        attributes: []
      }],
      attributes: [
        'currency',
        [sequelize.fn('SUM', sequelize.col('SalePayment.amount')), 'total_amount']
      ],
      group: ['currency'],
      raw: true
    });

    const creditCollectedByCurrency = {};
    creditCollections.forEach(c => {
      creditCollectedByCurrency[c.currency || 'USD'] = parseFloat(c.total_amount) || 0;
    });

    res.json({
      date: startOfDay.toISOString().split('T')[0],
      totalSalesUSD,
      totalSalesCOP: Math.round(totalSalesCOP),
      salesCount,
      creditTotalUSD,
      paymentsBreakdown,
      creditCollectedByCurrency
    });

  } catch (error) {
    console.error('Error generating daily closure:', error);
    res.status(500).json({
      message: 'Error al generar el cierre de caja',
      error: error.message
    });
  }
};

// Validate credit PIN against admin users
exports.validateCreditPin = async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ success: false, message: 'PIN debe ser de 4 a 6 dígitos' });
    }

    // Find admin users with a credit_pin set (raw SQL because credit_pin is not in User model)
    const admins = await sequelize.query(
      `SELECT u.id, u.first_name, u.last_name, u.credit_pin, u.credit_pin_attempts, u.credit_pin_locked_until
       FROM users u
       INNER JOIN roles r ON u.role_id = r.id
       WHERE r.name = 'Administrador'
         AND u.credit_pin IS NOT NULL
         AND u.is_active = 1`,
      { type: sequelize.QueryTypes.SELECT }
    );

    if (!admins || admins.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay administradores con PIN configurado'
      });
    }

    for (const admin of admins) {
      // Check lockout
      if (admin.credit_pin_locked_until && new Date(admin.credit_pin_locked_until) > new Date()) {
        continue;
      }

      const match = await bcrypt.compare(pin, admin.credit_pin);

      if (match) {
        await sequelize.query(
          'UPDATE users SET credit_pin_attempts = 0, credit_pin_locked_until = NULL WHERE id = ?',
          { replacements: [admin.id] }
        );
        return res.json({
          success: true,
          admin_id: admin.id,
          admin_name: `${admin.first_name} ${admin.last_name}`
        });
      }
    }

    // No match — increment attempts for all non-locked admins
    for (const admin of admins) {
      if (admin.credit_pin_locked_until && new Date(admin.credit_pin_locked_until) > new Date()) continue;

      const attempts = (admin.credit_pin_attempts || 0) + 1;
      if (attempts >= 3) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await sequelize.query(
          'UPDATE users SET credit_pin_attempts = ?, credit_pin_locked_until = ? WHERE id = ?',
          { replacements: [attempts, lockUntil, admin.id] }
        );
      } else {
        await sequelize.query(
          'UPDATE users SET credit_pin_attempts = ? WHERE id = ?',
          { replacements: [attempts, admin.id] }
        );
      }
    }

    // Check if all admins are now locked
    const allLocked = admins.every(a => {
      const attempts = (a.credit_pin_attempts || 0) + 1;
      return attempts >= 3 || (a.credit_pin_locked_until && new Date(a.credit_pin_locked_until) > new Date());
    });

    return res.status(400).json({
      success: false,
      message: allLocked
        ? 'PIN bloqueado por demasiados intentos. Intente en 15 minutos.'
        : 'PIN incorrecto'
    });
  } catch (error) {
    console.error('Error validating credit PIN:', error);
    res.status(500).json({ success: false, message: 'Error al validar PIN' });
  }
};
