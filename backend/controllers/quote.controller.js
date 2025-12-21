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
      customerId = '',
      dateFrom = '',
      dateTo = ''
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

    if (customerId) {
      where.customerId = customerId;
    }

    if (dateFrom) {
      where.quoteDate = {
        ...where.quoteDate,
        [Op.gte]: new Date(dateFrom)
      };
    }

    if (dateTo) {
      where.quoteDate = {
        ...where.quoteDate,
        [Op.lte]: new Date(dateTo)
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
      success: true,
      data: {
        quotes,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
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
        success: false,
        message: 'Cotización no encontrada'
      });
    }

    res.json({
      success: true,
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
    const { customerId, priceListId, currency, details, notes, internalNotes, paymentTerms, deliveryTerms, validUntil } = req.body;

    // Verificar que el cliente existe
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      await t.rollback();
      return res.status(404).json({
        success: false,
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
          success: false,
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
      customerId,
      priceListId,
      userId: req.user.id,
      currency: currency || 'PEN',
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
      success: true,
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
    const { customerId, priceListId, currency, details, notes, internalNotes, paymentTerms, deliveryTerms, validUntil, status } = req.body;

    // Buscar la cotización
    const quote = await Quote.findOne({
      where: { id, isDeleted: false }
    });

    if (!quote) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Cotización no encontrada'
      });
    }

    // Verificar si puede ser editada
    if (!quote.canBeEdited() && !status) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Esta cotización no puede ser editada en su estado actual'
      });
    }

    // Si solo se actualiza el estado
    if (status && !details) {
      await quote.update({ status }, { transaction: t });
      await t.commit();

      return res.json({
        success: true,
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
            success: false,
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
      customerId: customerId || quote.customerId,
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
      success: true,
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
        success: false,
        message: 'Cotización no encontrada'
      });
    }

    // Solo se puede eliminar en estado draft
    if (quote.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden eliminar cotizaciones en estado borrador'
      });
    }

    await quote.update({ isDeleted: true });

    res.json({
      success: true,
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
    const { dateFrom, dateTo } = req.query;

    const where = { isDeleted: false };

    if (dateFrom) {
      where.quoteDate = {
        ...where.quoteDate,
        [Op.gte]: new Date(dateFrom)
      };
    }

    if (dateTo) {
      where.quoteDate = {
        ...where.quoteDate,
        [Op.lte]: new Date(dateTo)
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
      success: true,
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
