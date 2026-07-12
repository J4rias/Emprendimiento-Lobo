// Express type imports (ALWAYS at the top)
import { Request, Response, NextFunction } from 'express';

// Sequelize imports (only what is used in the controller)
import { Op } from 'sequelize';

// Model imports (esModuleInterop — require with export = in the .ts files)
import Quote from '../models/Quote';
import QuoteDetail from '../models/QuoteDetail';
import Customer from '../models/Customer';
import Product from '../models/Product';
import ProductPresentation from '../models/ProductPresentation';
import User from '../models/User';
import PriceList from '../models/PriceList';
import Warehouse from '../models/Warehouse';
import * as saleService from '../services/sale.service';

// Other requires that are not models/sequelize/express → leave as require()
const { sequelize } = require('../config/database');

/**
 * Obtener todas las cotizaciones con filtros y paginación
 */
export const getAllQuotes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page: pageStr = '1',
      limit: limitStr = '20',
      search = '',
      status = '',
      customer_id = '',
      date_from = '',
      date_to = '',
      sort_by = 'created_at',
      sort_dir = 'DESC'
    } = req.query as Record<string, string>;

    const page = parseInt(pageStr, 10);
    const limit = parseInt(limitStr, 10);
    const offset = (page - 1) * limit;

    // Construir condiciones de búsqueda
    const where: any = {};

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
      where.quote_date = {
        ...where.quote_date,
        [Op.gte]: new Date(date_from)
      };
    }

    if (date_to) {
      where.quote_date = {
        ...where.quote_date,
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
          attributes: ['id', 'code', 'first_name', 'last_name', 'business_name', 'trade_name', 'type']
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
      limit,
      offset,
      order: [[sort_by, sort_dir.toUpperCase()] as [string, string]]
    }) as any;

    res.json({
      data: quotes,
      pagination: {
        total: count,
        page,
        limit,
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
export const getQuoteById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const quote = await Quote.findOne({
      where: { id },
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
              attributes: ['id', 'name', 'units_per_package']
            }
          ],
          order: [['line_order', 'ASC']]
        }
      ]
    }) as any;

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
export const createQuote = async (req: Request, res: Response, next: NextFunction) => {
  const t = await sequelize.transaction();

  try {
    const { customer_id, price_list_id, currency, details, notes, internal_notes, payment_terms, delivery_terms, valid_until } = req.body;

    // Verificar que el cliente existe
    const customer = await Customer.findByPk(customer_id) as any;
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
      const product = await Product.findByPk(detail.product_id) as any;
      if (!product) {
        await t.rollback();
        return res.status(404).json({
          message: `Producto con ID ${detail.product_id} no encontrado`
        });
      }

      const lineSubtotal = detail.quantity * detail.unit_price;
      const lineDiscountAmount = (lineSubtotal * (detail.discount_percentage || 0)) / 100;
      const lineBaseAmount = lineSubtotal - lineDiscountAmount;
      const lineTaxAmount = (lineBaseAmount * (detail.tax_percentage || 18)) / 100;
      const lineTotal = lineBaseAmount + lineTaxAmount;

      subtotal += lineSubtotal;

      detailsData.push({
        product_id: detail.product_id,
        product_presentation_id: detail.product_presentation_id,
        description: detail.description || product.name,
        quantity: detail.quantity,
        unit_price: detail.unit_price,
        discount_percentage: detail.discount_percentage || 0,
        discount_amount: lineDiscountAmount,
        tax_percentage: detail.tax_percentage || 18,
        tax_amount: lineTaxAmount,
        subtotal: lineSubtotal,
        total: lineTotal,
        notes: detail.notes,
        line_order: i + 1
      });
    }

    // Crear la cotización
    const quote = await Quote.create({
      customer_id,
      price_list_id,
      user_id: (req as any).user.id,
      currency: currency || 'USD',
      subtotal,
      notes,
      internal_notes,
      payment_terms,
      delivery_terms,
      valid_until
    } as any, { transaction: t }) as any;

    // Crear los detalles de la cotización
    for (const detailData of detailsData) {
      await QuoteDetail.create({
        quote_id: quote.id,
        ...detailData
      }, { transaction: t }) as any;
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
    }) as any;

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
export const updateQuote = async (req: Request, res: Response, next: NextFunction) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { customer_id, price_list_id, currency, details, notes, internal_notes, payment_terms, delivery_terms, valid_until, status } = req.body;

    // Buscar la cotización
    const quote = await Quote.findOne({
      where: { id }
    }) as any;

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
        where: { quote_id: id },
        transaction: t
      });

      // Crear nuevos detalles
      const detailsData = [];

      for (let i = 0; i < details.length; i++) {
        const detail = details[i];

        const product = await Product.findByPk(detail.product_id) as any;
        if (!product) {
          await t.rollback();
          return res.status(404).json({
            message: `Producto con ID ${detail.product_id} no encontrado`
          });
        }

        const lineSubtotal = detail.quantity * detail.unit_price;
        const lineDiscountAmount = (lineSubtotal * (detail.discount_percentage || 0)) / 100;
        const lineBaseAmount = lineSubtotal - lineDiscountAmount;
        const lineTaxAmount = (lineBaseAmount * (detail.tax_percentage || 18)) / 100;
        const lineTotal = lineBaseAmount + lineTaxAmount;

        subtotal += lineSubtotal;

        detailsData.push({
          product_id: detail.product_id,
          product_presentation_id: detail.product_presentation_id,
          description: detail.description || product.name,
          quantity: detail.quantity,
          unit_price: detail.unit_price,
          discount_percentage: detail.discount_percentage || 0,
          discount_amount: lineDiscountAmount,
          tax_percentage: detail.tax_percentage || 18,
          tax_amount: lineTaxAmount,
          subtotal: lineSubtotal,
          total: lineTotal,
          notes: detail.notes,
          line_order: i + 1
        });
      }

      // Crear los nuevos detalles
      for (const detailData of detailsData) {
        await QuoteDetail.create({
          quote_id: parseInt(id as string),
          ...detailData
        } as any, { transaction: t }) as any;
      }
    }

    // Actualizar la cotización
    await quote.update({
      customer_id: customer_id || quote.customer_id,
      price_list_id: price_list_id !== undefined ? price_list_id : quote.price_list_id,
      currency: currency || quote.currency,
      subtotal: details ? subtotal : quote.subtotal,
      notes: notes !== undefined ? notes : quote.notes,
      internal_notes: internal_notes !== undefined ? internal_notes : quote.internal_notes,
      payment_terms: payment_terms !== undefined ? payment_terms : quote.payment_terms,
      delivery_terms: delivery_terms !== undefined ? delivery_terms : quote.delivery_terms,
      valid_until: valid_until || quote.valid_until,
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
    }) as any;

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
export const deleteQuote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const quote = await Quote.findOne({
      where: { id }
    }) as any;

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

    await quote.destroy();

    res.json({
      message: 'Cotización eliminada exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar estado de una cotización (approve / reject / sent)
 * PATCH /api/quotes/:id/status
 */
export const updateQuoteStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: string };

    const allowed = ['draft', 'sent', 'approved', 'rejected'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Estado inválido. Permitidos: ${allowed.join(', ')}` });
    }

    const quote = await Quote.findByPk(id) as any;
    if (!quote) return res.status(404).json({ message: 'Cotización no encontrada' });
    if (quote.status === 'converted') {
      return res.status(400).json({ message: 'No se puede cambiar el estado de una cotización ya convertida' });
    }

    await quote.update({ status });
    res.json({ message: 'Estado actualizado', data: quote });
  } catch (error) {
    next(error);
  }
};

/**
 * Convertir cotización a venta a crédito
 * POST /api/quotes/:id/convert
 */
export const convertQuote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role?.name || '';

    // 1. Load quote with details
    const quote = await Quote.findOne({
      where: { id },
      include: [{
        model: QuoteDetail,
        as: 'details',
        include: [
          { model: Product, as: 'product', attributes: ['id', 'name'] },
          { model: ProductPresentation, as: 'presentation', attributes: ['id', 'name', 'units_per_package', 'cost', 'package_cost', 'purchase_currency'] }
        ]
      }]
    }) as any;

    if (!quote) return res.status(404).json({ message: 'Cotización no encontrada' });

    // 2. Business rule validations
    if (quote.status === 'converted') {
      return res.status(400).json({ message: 'Esta cotización ya fue convertida a venta' });
    }
    if (!['approved', 'sent', 'draft'].includes(quote.status)) {
      return res.status(400).json({ message: 'Solo se pueden convertir cotizaciones aprobadas, enviadas o en borrador' });
    }
    if (quote.isExpired()) {
      return res.status(400).json({ message: 'La cotización está vencida y no puede ser convertida' });
    }
    if (!quote.details || quote.details.length === 0) {
      return res.status(400).json({ message: 'La cotización no tiene productos' });
    }

    // 3. Validate all items have presentations
    const missingPresentation = quote.details.find((d: any) => !d.product_presentation_id);
    if (missingPresentation) {
      return res.status(400).json({
        message: `El producto "${missingPresentation.product?.name}" no tiene presentación asignada. Edite la cotización antes de convertir.`
      });
    }

    // 4. Get warehouse (only one in this system)
    const warehouse = await Warehouse.findOne({ where: { is_active: true } }) as any;
    if (!warehouse) return res.status(500).json({ message: 'No se encontró depósito activo' });

    // 5. Get current exchange rate
    const rateRow = await sequelize.query(
      `SELECT rate FROM exchange_rates WHERE from_currency = 'USD' AND to_currency = 'COP' ORDER BY created_at DESC LIMIT 1`,
      { type: sequelize.QueryTypes.SELECT }
    ) as any[];
    const exchangeRate = rateRow.length > 0 ? parseFloat(rateRow[0].rate) : 1;

    // 6. Map quote details to sale items
    const items = (quote.details as any[]).map((d: any) => ({
      product_id: d.product_id,
      presentation_id: d.product_presentation_id,
      quantity: parseFloat(d.quantity),
      unit_price: parseFloat(d.unit_price),
      is_unit: false,
      discount_percent: parseFloat(d.discount_percentage || 0),
      tax_percent: 0, // quote taxes not mapped to sale taxes (different systems)
      notes: d.notes || null
    }));

    // 7. Determine currency_mode from quote currency
    const currency_mode = quote.currency === 'USD' ? 'USD' : 'COP';

    // 8. Create credit sale
    const { sale } = await saleService.createSale(
      {
        customer_id: quote.customer_id,
        warehouse_id: warehouse.id,
        sale_type: 'credit',
        currency_mode,
        exchange_rate: exchangeRate,
        payment_lines: [],
        items,
        notes: `Generada desde cotización ${quote.code}${quote.notes ? '\n' + quote.notes : ''}`,
        authorized_by: userId
      },
      userId,
      userRole
    );

    // 9. Mark quote as converted
    await quote.update({
      status: 'converted',
      converted_to_sale_id: sale.id,
      converted_at: new Date()
    });

    res.status(201).json({
      message: `Cotización ${quote.code} convertida a venta ${sale.sale_number} exitosamente`,
      data: {
        sale_id: sale.id,
        sale_number: sale.sale_number,
        quote_code: quote.code
      }
    });
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message, ...(error.details || {}) });
    }
    next(error);
  }
};

/**
 * Obtener estadísticas de cotizaciones
 */
export const getQuoteStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date_from, date_to } = req.query;

    const where: any = {};

    if (date_from) {
      where.quote_date = {
        ...where.quote_date,
        [Op.gte]: new Date(date_from as string)
      };
    }

    if (date_to) {
      where.quote_date = {
        ...where.quote_date,
        [Op.lte]: new Date(date_to as string)
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
    }) as any[];

    // Total general
    const totals = await Quote.findOne({
      where,
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalQuotes'],
        [sequelize.fn('SUM', sequelize.col('total')), 'totalAmount']
      ],
      raw: true
    }) as any;

    // Tasa de conversión
    const convertedCount = await Quote.count({
      where: {
        ...where,
        status: 'converted'
      }
    });

    const conversionRate = totals.totalQuotes > 0
      ? ((convertedCount / totals.totalQuotes) * 100).toFixed(2)
      : '0';

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
