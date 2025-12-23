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
      payment_method,
      items,
      discount_amount = 0,
      notes,
      paid_amount = 0,
      quote_id
    } = req.body;

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

      if (!inventory || inventory.available_quantity < item.quantity) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: `Stock insuficiente para ${product.name}. Disponible: ${inventory?.available_quantity || 0}` 
        });
      }

      const unit_price = item.unit_price || presentation.sale_price;
      const item_subtotal = unit_price * item.quantity;
      const item_discount = item.discount_percent ? (item_subtotal * item.discount_percent / 100) : 0;
      const taxable_amount = item_subtotal - item_discount;
      const item_tax = taxable_amount * (item.tax_percent || 16) / 100;
      const item_total = taxable_amount + item_tax;

      subtotal += item_subtotal;
      tax_amount += item_tax;

      saleDetails.push({
        product_id: item.product_id,
        presentation_id: item.presentation_id,
        batch_id: item.batch_id || null,
        quantity: item.quantity,
        unit_price: unit_price,
        discount_percent: item.discount_percent || 0,
        discount_amount: item_discount,
        tax_percent: item.tax_percent || 16,
        tax_amount: item_tax,
        subtotal: item_subtotal,
        total: item_total,
        cost_price: presentation.cost_price,
        notes: item.notes || null
      });

      await inventory.update({
        available_quantity: inventory.available_quantity - item.quantity,
        reserved_quantity: inventory.reserved_quantity + item.quantity
      }, { transaction });
    }

    const total = subtotal - discount_amount + tax_amount;
    const change_amount = sale_type === 'cash' ? Math.max(0, paid_amount - total) : 0;

    const sale = await Sale.create({
      sale_number,
      customer_id: customer_id || null,
      warehouse_id,
      user_id: req.user.id,
      sale_date: new Date(),
      sale_type,
      payment_method: sale_type === 'cash' ? payment_method : null,
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

    if (sale_type === 'cash' && paid_amount > 0) {
      await SalePayment.create({
        sale_id: sale.id,
        payment_date: new Date(),
        payment_method,
        amount: paid_amount,
        created_by: req.user.id
      }, { transaction });
    }

    if (sale_type === 'cash') {
      for (const item of items) {
        const inventory = await Inventory.findOne({
          where: {
            product_id: item.product_id,
            warehouse_id: warehouse_id
          }
        });

        await inventory.update({
          reserved_quantity: inventory.reserved_quantity - item.quantity
        }, { transaction });
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
          attributes: ['id', 'name', 'document_number']
        },
        { 
          model: Warehouse, 
          as: 'warehouse',
          attributes: ['id', 'name']
        },
        { 
          model: User, 
          as: 'seller',
          attributes: ['id', 'name', 'email']
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
              attributes: ['id', 'name', 'unit_type']
            },
            {
              model: Batch,
              as: 'batch',
              attributes: ['id', 'batch_number', 'expiry_date']
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
          attributes: ['id', 'name', 'email']
        },
        {
          model: SalePayment,
          as: 'payments',
          include: [
            {
              model: User,
              as: 'creator',
              attributes: ['id', 'name']
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
      include: [{ model: SaleDetail, as: 'details' }]
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
        if (sale.status === 'completed') {
          await inventory.update({
            available_quantity: inventory.available_quantity + detail.quantity
          }, { transaction });
        } else if (sale.status === 'pending') {
          await inventory.update({
            available_quantity: inventory.available_quantity + detail.quantity,
            reserved_quantity: inventory.reserved_quantity - detail.quantity
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
    const { payment_method, amount, reference, notes } = req.body;

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

    const payment = await SalePayment.create({
      sale_id: sale.id,
      payment_date: new Date(),
      payment_method,
      amount,
      reference: reference || null,
      notes: notes || null,
      created_by: req.user.id
    }, { transaction });

    const newPaidAmount = parseFloat(sale.paid_amount) + parseFloat(amount);
    const newStatus = newPaidAmount >= parseFloat(sale.total) ? 'completed' : 'pending';

    await sale.update({
      paid_amount: newPaidAmount,
      status: newStatus,
      updated_by: req.user.id
    }, { transaction });

    if (newStatus === 'completed') {
      const saleDetails = await SaleDetail.findAll({
        where: { sale_id: sale.id }
      });

      for (const detail of saleDetails) {
        const inventory = await Inventory.findOne({
          where: {
            product_id: detail.product_id,
            warehouse_id: sale.warehouse_id
          }
        });

        if (inventory) {
          await inventory.update({
            reserved_quantity: inventory.reserved_quantity - detail.quantity
          }, { transaction });
        }
      }
    }

    await transaction.commit();

    const updatedSale = await Sale.findByPk(id, {
      include: [
        { model: SalePayment, as: 'payments' }
      ]
    });

    res.json({
      message: 'Pago registrado exitosamente',
      payment,
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
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('total')), 'total']
      ],
      group: ['sale_type']
    });

    const salesByStatus = await Sale.findAll({
      where,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('total')), 'total']
      ],
      group: ['status']
    });

    const topProducts = await SaleDetail.findAll({
      attributes: [
        'product_id',
        [sequelize.fn('SUM', sequelize.col('quantity')), 'total_quantity'],
        [sequelize.fn('SUM', sequelize.col('total')), 'total_amount']
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
      group: ['product_id'],
      order: [[sequelize.fn('SUM', sequelize.col('quantity')), 'DESC']],
      limit: 10
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
