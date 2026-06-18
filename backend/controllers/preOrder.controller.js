const { PreOrder, PreOrderDetail, Product, ProductPresentation, Customer, Warehouse, Sale, User, Inventory, ExchangeRate, sequelize } = require('../models');
const { Op } = require('sequelize');

// POST /api/pre-orders
exports.create = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      customer_id,
      customer_name,
      customer_phone,
      channel = 'messenger',
      notes,
      currency = 'USD',
      items
    } = req.body;

    if (!items || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'El pre-pedido debe tener al menos un producto' });
    }

    // Get warehouse (single warehouse system)
    const warehouse = await Warehouse.findOne({ where: { is_active: true }, transaction });
    if (!warehouse) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'No hay almacén activo' });
    }

    // Get current exchange rate
    let exchangeRate = null;
    try {
      exchangeRate = await ExchangeRate.getRate('COP', 'USD');
    } catch (e) { /* optional */ }

    let subtotal = 0;
    const details = [];

    for (const item of items) {
      const presentation = await ProductPresentation.findByPk(item.presentation_id, {
        include: [{ model: Product, as: 'product' }],
        transaction
      });
      if (!presentation) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: `Presentación ${item.presentation_id} no encontrada` });
      }

      const unitPrice = parseFloat(item.unit_price) || parseFloat(presentation.base_price);
      const quantity = parseFloat(item.quantity) || 1;
      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;

      details.push({
        productId: presentation.product_id,
        presentationId: item.presentation_id,
        quantity,
        isUnit: item.is_unit || false,
        unitPrice,
        total: lineTotal,
        notes: item.notes || null
      });
    }

    const preOrder = await PreOrder.create({
      customerId: customer_id || null,
      customerName: customer_name || null,
      customerPhone: customer_phone || null,
      channel,
      notes,
      subtotal,
      total: subtotal,
      currency,
      exchangeRate: exchangeRate ? 1 / exchangeRate : null, // Store as COP/USD
      createdBy: req.userId,
      warehouseId: warehouse.id
    }, { transaction });

    for (const detail of details) {
      await PreOrderDetail.create({
        preOrderId: preOrder.id,
        ...detail
      }, { transaction });
    }

    await transaction.commit();

    const result = await PreOrder.findByPk(preOrder.id, {
      include: [
        { model: PreOrderDetail, as: 'details', include: [
          { model: Product, as: 'product', attributes: ['id', 'name'] },
          { model: ProductPresentation, as: 'presentation', attributes: ['id', 'name', 'units_per_package'] }
        ]},
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] }
      ]
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: 'Error al crear pre-pedido', error: error.message });
  }
};

// GET /api/pre-orders
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, channel } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (channel) where.channel = channel;

    const { count, rows } = await PreOrder.findAndCountAll({
      where,
      include: [
        { model: PreOrderDetail, as: 'details', include: [
          { model: Product, as: 'product', attributes: ['id', 'name'] },
          { model: ProductPresentation, as: 'presentation', attributes: ['id', 'name'] }
        ]},
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: User, as: 'approver', attributes: ['id', 'first_name', 'last_name'] }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener pre-pedidos', error: error.message });
  }
};

// GET /api/pre-orders/stats
exports.getStats = async (req, res) => {
  try {
    const pending = await PreOrder.count({ where: { status: 'pending' } });
    const approved = await PreOrder.count({ where: { status: 'approved' } });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await PreOrder.count({
      where: { created_at: { [Op.gte]: today } }
    });

    res.json({
      success: true,
      data: { pending, approved, today: todayCount }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener estadísticas', error: error.message });
  }
};

// GET /api/pre-orders/:id
exports.getById = async (req, res) => {
  try {
    const preOrder = await PreOrder.findByPk(req.params.id, {
      include: [
        { model: PreOrderDetail, as: 'details', include: [
          { model: Product, as: 'product', attributes: ['id', 'name'] },
          { model: ProductPresentation, as: 'presentation', attributes: ['id', 'name', 'units_per_package', 'base_price'] }
        ]},
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'email'] },
        { model: User, as: 'approver', attributes: ['id', 'first_name', 'last_name'] },
        { model: Sale, as: 'convertedSale', attributes: ['id', 'sale_number', 'total'] }
      ]
    });

    if (!preOrder) {
      return res.status(404).json({ success: false, message: 'Pre-pedido no encontrado' });
    }

    res.json({ success: true, data: preOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener pre-pedido', error: error.message });
  }
};

// PUT /api/pre-orders/:id/approve
exports.approve = async (req, res) => {
  try {
    const preOrder = await PreOrder.findByPk(req.params.id);
    if (!preOrder) {
      return res.status(404).json({ success: false, message: 'Pre-pedido no encontrado' });
    }
    if (!preOrder.canBeApproved()) {
      return res.status(400).json({ success: false, message: `No se puede aprobar un pre-pedido con estado "${preOrder.status}"` });
    }

    await preOrder.update({
      status: 'approved',
      approvedBy: req.userId,
      approvedAt: new Date()
    });

    res.json({ success: true, data: preOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al aprobar pre-pedido', error: error.message });
  }
};

// PUT /api/pre-orders/:id/reject
exports.reject = async (req, res) => {
  try {
    const preOrder = await PreOrder.findByPk(req.params.id);
    if (!preOrder) {
      return res.status(404).json({ success: false, message: 'Pre-pedido no encontrado' });
    }
    if (!preOrder.canBeApproved()) {
      return res.status(400).json({ success: false, message: `No se puede rechazar un pre-pedido con estado "${preOrder.status}"` });
    }

    await preOrder.update({
      status: 'rejected',
      approvedBy: req.userId,
      approvedAt: new Date()
    });

    res.json({ success: true, data: preOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al rechazar pre-pedido', error: error.message });
  }
};

// POST /api/pre-orders/:id/convert
exports.convert = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const preOrder = await PreOrder.findByPk(req.params.id, {
      include: [{ model: PreOrderDetail, as: 'details', include: [
        { model: ProductPresentation, as: 'presentation' }
      ]}],
      transaction
    });

    if (!preOrder) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Pre-pedido no encontrado' });
    }
    if (!preOrder.canBeConverted()) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: `Solo se pueden convertir pre-pedidos aprobados. Estado actual: "${preOrder.status}"` });
    }

    // Check stock availability before converting
    for (const detail of preOrder.details) {
      const inventory = await Inventory.findOne({
        where: {
          product_id: detail.productId,
          warehouse_id: preOrder.warehouseId
        },
        transaction
      });

      const unitsNeeded = detail.isUnit
        ? parseFloat(detail.quantity)
        : parseFloat(detail.quantity) * (detail.presentation?.units_per_package || 1);

      const available = inventory ? parseFloat(inventory.quantity) : 0;

      if (available < unitsNeeded) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: `Stock insuficiente para ${detail.presentation?.name || 'producto'}. Disponible: ${available}, Necesario: ${unitsNeeded}`
        });
      }
    }

    // Build sale payload and use the createSale endpoint internally
    // We build the items array matching createSale's expected format
    const saleItems = preOrder.details.map(d => ({
      product_id: d.productId,
      presentation_id: d.presentationId,
      quantity: parseFloat(d.quantity),
      unit_price: parseFloat(d.unitPrice),
      is_unit: d.isUnit
    }));

    // Get current exchange rate for the sale
    let exchangeRate = 1;
    try {
      const copUsd = await ExchangeRate.getRate('COP', 'USD');
      exchangeRate = copUsd > 0 ? 1 / copUsd : 1; // Store as COP per USD
    } catch (e) { /* fallback to 1 */ }

    // Create a minimal sale request body
    // The sale will be created as cash type with no payment (to be completed at POS)
    const saleBody = {
      customer_id: preOrder.customerId,
      warehouse_id: preOrder.warehouseId,
      sale_type: req.body.sale_type || 'cash',
      currency_mode: preOrder.currency === 'USD' ? 'USD' : 'COP',
      items: saleItems,
      exchange_rate: exchangeRate,
      notes: `Convertido de pre-pedido ${preOrder.code}`,
      payment_lines: req.body.payment_lines || []
    };

    // Calculate paid_amount from payment_lines
    const cashLines = saleBody.payment_lines.filter(l => l.method !== 'credit');
    let paid_amount = 0;
    if (cashLines.length > 0) {
      paid_amount = cashLines.reduce((sum, line) => {
        const amount = parseFloat(line.amount) || 0;
        if (amount <= 0) return sum;
        const rate = parseFloat(line.exchange_rate) || 1;
        return sum + (amount / rate);
      }, 0);
    }

    // Process items for sale creation (replicating createSale logic)
    const { Sale: SaleModel, SaleDetail, SalePayment } = require('../models');

    // Generate sale number
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const prefix = `VEN-${year}${month}${day}`;
    const lastSale = await SaleModel.findOne({
      where: { sale_number: { [Op.like]: `${prefix}%` } },
      order: [['sale_number', 'DESC']],
      transaction
    });
    let sequence = 1;
    if (lastSale) {
      sequence = parseInt(lastSale.sale_number.split('-').pop()) + 1;
    }
    const sale_number = `${prefix}-${String(sequence).padStart(4, '0')}`;

    let subtotal = 0;
    let tax_amount = 0;
    const saleDetails = [];
    let vesUsdRate = null;

    for (const item of saleItems) {
      const presentation = await ProductPresentation.findByPk(item.presentation_id, { transaction });
      const inventory = await Inventory.findOne({
        where: { product_id: item.product_id, warehouse_id: preOrder.warehouseId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      const unit_price = item.unit_price || presentation.base_price;
      const is_unit = item.is_unit || false;
      const item_subtotal = unit_price * item.quantity;
      subtotal += item_subtotal;

      const units_to_deduct = is_unit ? item.quantity : (item.quantity * (presentation.units_per_package || 1));

      // Calculate cost_price
      const rawCost = parseFloat(is_unit ? presentation.cost : presentation.package_cost) || 0;
      let costPrice = null;
      if (rawCost > 0) {
        if (presentation.purchase_currency === 'COP' && exchangeRate > 1) {
          costPrice = rawCost / exchangeRate;
        } else if (presentation.purchase_currency === 'VES') {
          if (vesUsdRate === null) {
            try { vesUsdRate = await ExchangeRate.getRate('VES', 'USD'); }
            catch (e) { vesUsdRate = 0; }
          }
          costPrice = vesUsdRate > 0 ? rawCost * vesUsdRate : null;
        } else {
          costPrice = rawCost;
        }
      }

      saleDetails.push({
        product_id: item.product_id,
        presentation_id: item.presentation_id,
        quantity: item.quantity,
        is_unit,
        unit_price,
        discount_percent: 0,
        discount_amount: 0,
        tax_percent: 0,
        tax_amount: 0,
        subtotal: item_subtotal,
        total: item_subtotal,
        cost_price: costPrice
      });

      // Deduct inventory
      await inventory.update({
        quantity: parseFloat(inventory.quantity) - units_to_deduct
      }, { transaction });
    }

    const total = subtotal;
    const change_amount = saleBody.sale_type === 'cash' ? Math.max(0, paid_amount - total) : 0;

    const sale = await SaleModel.create({
      sale_number,
      customer_id: saleBody.customer_id,
      warehouse_id: saleBody.warehouse_id,
      user_id: req.userId,
      created_by: req.userId,
      sale_type: saleBody.sale_type,
      currency_mode: saleBody.currency_mode,
      status: 'completed',
      subtotal,
      discount_amount: 0,
      tax_amount: 0,
      total,
      paid_amount,
      change_amount,
      credit_amount: 0,
      exchange_rate: exchangeRate,
      notes: saleBody.notes,
      sale_date: new Date()
    }, { transaction });

    for (const detail of saleDetails) {
      await SaleDetail.create({ sale_id: sale.id, ...detail }, { transaction });
    }

    // Create payment records
    if (saleBody.payment_lines.length > 0) {
      for (const line of saleBody.payment_lines) {
        await SalePayment.create({
          sale_id: sale.id,
          amount: parseFloat(line.amount),
          currency: line.currency || 'USD',
          method: line.method || 'cash',
          exchange_rate: parseFloat(line.exchange_rate) || 1,
          reference: line.reference || null,
          created_by: req.userId
        }, { transaction });
      }
    }

    // Update pre-order status
    await preOrder.update({
      status: 'converted',
      convertedSaleId: sale.id
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      data: {
        preOrder: { id: preOrder.id, code: preOrder.code, status: 'converted' },
        sale: { id: sale.id, sale_number: sale.sale_number, total: sale.total }
      }
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: 'Error al convertir pre-pedido', error: error.message });
  }
};
