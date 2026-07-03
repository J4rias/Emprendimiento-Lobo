const { Quote, QuoteDetail, Customer, Product, ProductPresentation, User, PriceList } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Obtener todas las cotizaciones con filtros y paginación
 */
exports.getAllQuotes = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      customer_id = '',
      date_from = '',
      date_to = ''
    } = req.query;

    const offset = (page - 1) * limit;

    // Construir condiciones de búsqueda
    const where = { isDeleted: false };

    if (search) {
      where[Op.or] = [
        { code: { [Op.like]: `%${search}%` } },
        { notes: { [Op.like]: `%${search}%` } }
      ];
    }

    if (status) {
      where.status = status;
    }

    if (customer_id) {
      where.customer_id = customer_id;
    }

    if (date_from) {
      where.quoteDate = {
        ...where.quoteDate,
        [Op.gte]: new Date(date_from)
      };
    }

    if (date_to) {
      where.quoteDate = {
        ...where.quoteDate,
        [Op.lte]: new Date(date_to)
      };
    }

    // Obtener cotizaciones con paginación
    const { count, rows: quotes } = await Quote.findAndCountAll({
      where,
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'code', 'firstName', 'lastName', 'businessName', 'tradeName', 'type']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'first_name', 'last_name']
        },
        {
          model: PriceList,
          as: 'priceList',
          attributes: ['id', 'code', 'name']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.json({
      data: quotes,
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

/**
 * Obtener una cotización por ID con todos sus detalles
 */
exports.getQuoteById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const quote = await Quote.findOne({
      where: { id, isDeleted: false },
      include: [
        {
          model: Customer,
          as: 'customer',
          include: [
            {
              model: PriceList,
              as: 'priceList'
            }
          ]
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'first_name', 'last_name']
        },
        {
          model: PriceList,
          as: 'priceList'
        },
        {
          model: QuoteDetail,
          as: 'details',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'sku', 'name', 'description']
            },
            {
              model: ProductPresentation,
              as: 'presentation',
              attributes: ['id', 'name', 'unitMultiplier']
            }
          ],
          order: [['lineOrder', 'ASC']]
        }
      ]
    });

    if (!quote) {
      return res.status(404).json({
        message: 'Cotización no encontrada'
      });
    }

    res.json({
      data: quote
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Crear una nueva cotización
 */
exports.createQuote = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const { customer_id, priceListId, currency, details, notes, internalNotes, paymentTerms, deliveryTerms, validUntil } = req.body;

    // Verificar que el cliente existe
    const customer = await Customer.findByPk(customer_id);
    if (!customer) {
      await t.rollback();
      return res.status(404).json({
        message: 'Cliente no encontrado'
      });
    }

    // Calcular subtotal de todos los detalles
    let subtotal = 0;
    const detailsData = [];

    for (let i = 0; i < details.length; i++) {
      const detail = details[i];

      // Verificar que el producto existe
      const product = await Product.findByPk(detail.productId);
      if (!product) {
        await t.rollback();
        return res.status(404).json({
          message: `Producto con ID ${detail.productId} no encontrado`
        });
      }

      const lineSubtotal = detail.quantity * detail.unitPrice;
      const lineDiscountAmount = (lineSubtotal * (detail.discountPercentage || 0)) / 100;
      const lineBaseAmount = lineSubtotal - lineDiscountAmount;
      const lineTaxAmount = (lineBaseAmount * (detail.taxPercentage || 18)) / 100;
      const lineTotal = lineBaseAmount + lineTaxAmount;

      subtotal += lineSubtotal;

      detailsData.push({
        productId: detail.productId,
        productPresentationId: detail.productPresentationId,
        description: detail.description || product.name,
        quantity: detail.quantity,
        unitPrice: detail.unitPrice,
        discountPercentage: detail.discountPercentage || 0,
        discountAmount: lineDiscountAmount,
        taxPercentage: detail.taxPercentage || 18,
        taxAmount: lineTaxAmount,
        subtotal: lineSubtotal,
        total: lineTotal,
        notes: detail.notes,
        lineOrder: i + 1
      });
    }

    // Crear la cotización
    const quote = await Quote.create({
      customer_id,
      priceListId,
      userId: req.user.id,
      currency: currency || 'USD',
      subtotal,
      notes,
      internalNotes,
      paymentTerms,
      deliveryTerms,
      validUntil
    }, { transaction: t });

    // Crear los detalles de la cotización
    for (const detailData of detailsData) {
      await QuoteDetail.create({
        quoteId: quote.id,
        ...detailData
      }, { transaction: t });
    }

    await t.commit();

    // Cargar la cotización completa con sus relaciones
    const fullQuote = await Quote.findOne({
      where: { id: quote.id },
      include: [
        {
          model: Customer,
          as: 'customer'
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'first_name', 'last_name']
        },
        {
          model: QuoteDetail,
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
      ]
    });

    res.status(201).json({
      message: 'Cotización creada exitosamente',
      data: fullQuote
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * Actualizar una cotización existente
 */
exports.updateQuote = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { customer_id, priceListId, currency, details, notes, internalNotes, paymentTerms, deliveryTerms, validUntil, status } = req.body;

    // Buscar la cotización
    const quote = await Quote.findOne({
      where: { id, isDeleted: false }
    });

    if (!quote) {
      await t.rollback();
      return res.status(404).json({
        message: 'Cotización no encontrada'
      });
    }

    // Verificar si puede ser editada
    if (!quote.canBeEdited() && !status) {
      await t.rollback();
      return res.status(400).json({
        message: 'Esta cotización no puede ser editada en su estado actual'
      });
    }

    // Si solo se actualiza el estado
    if (status && !details) {
      await quote.update({ status }, { transaction: t });
      await t.commit();

      return res.json({
        message: 'Estado de cotización actualizado',
        data: quote
      });
    }

    // Actualizar datos básicos
    let subtotal = 0;

    if (details && details.length > 0) {
      // Eliminar detalles anteriores
      await QuoteDetail.destroy({
        where: { quoteId: id },
        transaction: t
      });

      // Crear nuevos detalles
      const detailsData = [];

      for (let i = 0; i < details.length; i++) {
        const detail = details[i];

        const product = await Product.findByPk(detail.productId);
        if (!product) {
          await t.rollback();
          return res.status(404).json({
            message: `Producto con ID ${detail.productId} no encontrado`
          });
        }

        const lineSubtotal = detail.quantity * detail.unitPrice;
        const lineDiscountAmount = (lineSubtotal * (detail.discountPercentage || 0)) / 100;
        const lineBaseAmount = lineSubtotal - lineDiscountAmount;
        const lineTaxAmount = (lineBaseAmount * (detail.taxPercentage || 18)) / 100;
        const lineTotal = lineBaseAmount + lineTaxAmount;

        subtotal += lineSubtotal;

        detailsData.push({
          productId: detail.productId,
          productPresentationId: detail.productPresentationId,
          description: detail.description || product.name,
          quantity: detail.quantity,
          unitPrice: detail.unitPrice,
          discountPercentage: detail.discountPercentage || 0,
          discountAmount: lineDiscountAmount,
          taxPercentage: detail.taxPercentage || 18,
          taxAmount: lineTaxAmount,
          subtotal: lineSubtotal,
          total: lineTotal,
          notes: detail.notes,
          lineOrder: i + 1
        });
      }

      // Crear los nuevos detalles
      for (const detailData of detailsData) {
        await QuoteDetail.create({
          quoteId: id,
          ...detailData
        }, { transaction: t });
      }
    }

    // Actualizar la cotización
    await quote.update({
      customer_id: customer_id || quote.customer_id,
      priceListId: priceListId !== undefined ? priceListId : quote.priceListId,
      currency: currency || quote.currency,
      subtotal: details ? subtotal : quote.subtotal,
      notes: notes !== undefined ? notes : quote.notes,
      internalNotes: internalNotes !== undefined ? internalNotes : quote.internalNotes,
      paymentTerms: paymentTerms !== undefined ? paymentTerms : quote.paymentTerms,
      deliveryTerms: deliveryTerms !== undefined ? deliveryTerms : quote.deliveryTerms,
      validUntil: validUntil || quote.validUntil,
      status: status || quote.status
    }, { transaction: t });

    await t.commit();

    // Cargar la cotización completa
    const fullQuote = await Quote.findOne({
      where: { id },
      include: [
        {
          model: Customer,
          as: 'customer'
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'first_name', 'last_name']
        },
        {
          model: QuoteDetail,
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
      ]
    });

    res.json({
      message: 'Cotización actualizada exitosamente',
      data: fullQuote
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * Eliminar una cotización (soft delete)
 */
exports.deleteQuote = async (req, res, next) => {
  try {
    const { id } = req.params;

    const quote = await Quote.findOne({
      where: { id, isDeleted: false }
    });

    if (!quote) {
      return res.status(404).json({
        message: 'Cotización no encontrada'
      });
    }

    // Solo se puede eliminar en estado draft
    if (quote.status !== 'draft') {
      return res.status(400).json({
        message: 'Solo se pueden eliminar cotizaciones en estado borrador'
      });
    }

    await quote.update({ isDeleted: true });

    res.json({
      message: 'Cotización eliminada exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener estadísticas de cotizaciones
 */
exports.getQuoteStats = async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query;

    const where = { isDeleted: false };

    if (date_from) {
      where.quoteDate = {
        ...where.quoteDate,
        [Op.gte]: new Date(date_from)
      };
    }

    if (date_to) {
      where.quoteDate = {
        ...where.quoteDate,
        [Op.lte]: new Date(date_to)
      };
    }

    // Total de cotizaciones por estado
    const statusCounts = await Quote.findAll({
      where,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('total')), 'total']
      ],
      group: ['status'],
      raw: true
    });

    // Total general
    const totals = await Quote.findOne({
      where,
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalQuotes'],
        [sequelize.fn('SUM', sequelize.col('total')), 'totalAmount']
      ],
      raw: true
    });

    // Tasa de conversión
    const convertedCount = await Quote.count({
      where: {
        ...where,
        status: 'converted'
      }
    });

    const conversionRate = totals.totalQuotes > 0
      ? ((convertedCount / totals.totalQuotes) * 100).toFixed(2)
      : 0;

    res.json({
      data: {
        byStatus: statusCounts,
        totals: {
          totalQuotes: parseInt(totals.totalQuotes) || 0,
          totalAmount: parseFloat(totals.totalAmount) || 0,
          convertedCount,
          conversionRate: parseFloat(conversionRate)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;
