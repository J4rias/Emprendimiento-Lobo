import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Sale from '../models/Sale';
import SaleDetail from '../models/SaleDetail';
import SalePayment from '../models/SalePayment';
import Product from '../models/Product';
import ProductPresentation from '../models/ProductPresentation';
import Customer from '../models/Customer';
import Warehouse from '../models/Warehouse';
import User from '../models/User';
import Inventory from '../models/Inventory';
import InventoryMovement from '../models/InventoryMovement';
import Batch from '../models/Batch';
import PosReservation from '../models/PosReservation';
import Role from '../models/Role';
import CreditNote from '../models/CreditNote';
import ExchangeRate from '../models/ExchangeRate';
import * as saleService from '../services/sale.service';
import { ServiceError } from '../services/sale.service';

const bcrypt = require('bcryptjs');
const logger = require('../config/logger');
const { sequelize } = require('../config/database');

import { parseLocalDate, parseLocalDateEnd, localToday } from '../utils/dateUtils';

// generateSaleNumber moved to sale.service.ts

export const createSale = async (req: Request, res: Response) => {
  try {
    const { sale, affectedProductIds } = await saleService.createSale(
      { ...req.body, session_id: req.body.session_id, tab_id: req.body.tab_id },
      (req as any).user.id,
      (req as any).user.role?.name
    );

    // Release POS reservations for this tab and emit socket events (controller-level concern)
    const { session_id, tab_id } = req.body;
    if (session_id && tab_id) {
      await PosReservation.destroy({ where: { session_id, tab_id } });

      const io = req.app.get('io');
      if (io) {
        for (const product_id of affectedProductIds) {
          const totalReserved = await PosReservation.sum('units_reserved', {
            where: { product_id, expires_at: { [Op.gte]: new Date() } }
          }) || 0;
          io.to('pos-room').emit('reservation:changed', {
            product_id,
            total_reserved: totalReserved,
            action: 'sale_completed'
          });
        }
      }
    }

    return res.status(201).json({ message: 'Venta creada exitosamente', data: sale });

  } catch (error: any) {
    if (error instanceof ServiceError) {
      return res.status(error.status).json({ message: error.message, ...(error.extra || {}) });
    }
    logger.error('Error creating sale:', error);
    return res.status(500).json({ message: 'Error al crear la venta' });
  }
};

export const getSales = async (req: Request, res: Response) => {
  try {
    // ?sale_number=X shortcut — delegates to getSaleBySaleNumber logic inline
    if (req.query.sale_number) {
      const sale = await Sale.findOne({
        where: { sale_number: req.query.sale_number as string },
        include: [
          { model: SaleDetail, as: 'details', include: [
            { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
            { model: ProductPresentation, as: 'presentation', attributes: ['id', 'name'] },
            { model: Batch, as: 'batch', attributes: ['id', 'batch_number', 'expiration_date'] }
          ]},
          { model: Customer, as: 'customer' },
          { model: Warehouse, as: 'warehouse' },
          { model: User, as: 'seller', attributes: ['id', 'username', 'first_name', 'last_name'] },
          { model: SalePayment, as: 'payments', include: [
            { model: User, as: 'creator', attributes: ['id', 'username', 'first_name', 'last_name'] }
          ]}
        ]
      }) as any;
      if (!sale) return res.status(404).json({ message: 'Venta no encontrada' });
      return res.json({ data: sale });
    }

    const {
      page = 1,
      limit = 25,
      search = '',
      status,
      sale_type,
      customer_id,
      warehouse_id,
      date_from,
      date_to,
      sort_by = 'sale_date',
      sort_dir = 'DESC'
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const where: any = {};

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
      const statuses = (status as string).split(',').map((s: string) => s.trim()).filter(Boolean);
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

    if (date_from && date_to) {
      where.sale_date = { [Op.between]: [parseLocalDate(date_from as string), parseLocalDateEnd(date_to as string)] };
    } else if (date_from) {
      where.sale_date = { [Op.gte]: parseLocalDate(date_from as string) };
    } else if (date_to) {
      where.sale_date = { [Op.lte]: parseLocalDateEnd(date_to as string) };
    }

    const { count, rows } = await Sale.findAndCountAll({
      where,
      include: [
        { model: Customer, as: 'customer' },
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
      limit: parseInt(limit as string),
      offset,
      order: [[sort_by as string, (sort_dir as string).toUpperCase()]],
      subQuery: false
    }) as any;

    // Fetch credit-note aggregates for the returned sale IDs in a single query
    const saleIds = rows.map((r: any) => r.id);
    let cnAggMap: any = {};
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

    const salesWithCN = rows.map((r: any) => ({
      ...r.toJSON(),
      cn_count: cnAggMap[r.id]?.cn_count || 0,
      cn_total_cop: cnAggMap[r.id]?.cn_total_cop || 0
    }));

    res.json({
      data: salesWithCN,
      pagination: {
        total: count,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(count / Number(limit))
      }
    });

  } catch (error) {
    logger.error('Error fetching sales:', error);
    res.status(500).json({
      message: 'Error al obtener las ventas'
    });
  }
};

export const getSaleById = async (req: Request, res: Response) => {
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
    }) as any;

    if (!sale) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    res.json({ data: sale });

  } catch (error) {
    logger.error('Error fetching sale:', error);
    res.status(500).json({
      message: 'Error al obtener la venta'
    });
  }
};

export const getSaleBySaleNumber = async (req: Request, res: Response) => {
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
    }) as any;

    if (!sale) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    res.json({ data: sale });

  } catch (error) {
    logger.error('Error fetching sale by number:', error);
    res.status(500).json({ message: 'Error al obtener la venta' });
  }
};

export const updateSale = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const sale = await Sale.findByPk(id) as any;

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
      updated_by: (req as any).user.id
    }, { transaction });

    await transaction.commit();

    const updatedSale = await Sale.findByPk(id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: Warehouse, as: 'warehouse' },
        { model: User, as: 'seller' }
      ]
    }) as any;

    res.json({
      message: 'Venta actualizada exitosamente',
      data: updatedSale
    });

  } catch (error) {
    await transaction.rollback();
    logger.error('Error updating sale:', error);
    res.status(500).json({
      message: 'Error al actualizar la venta'
    });
  }
};

export const cancelSale = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const { sale, refund_lines } = await saleService.cancelSale(parseInt(id), reason, (req as any).user.id);
    return res.json({ message: 'Venta cancelada exitosamente', data: sale, refund_lines });
  } catch (error: any) {
    if (error instanceof ServiceError) {
      return res.status(error.status).json({ message: error.message });
    }
    logger.error('Error cancelling sale:', error);
    return res.status(500).json({ message: 'Error al cancelar la venta' });
  }
};

export const addPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { payment_lines = [], notes } = req.body;
    const { payments, sale } = await saleService.addPayment(
      parseInt(id),
      payment_lines,
      notes || null,
      (req as any).user.id
    );
    return res.json({ message: 'Pagos registrados exitosamente', data: { payments, sale } });
  } catch (error: any) {
    if (error instanceof ServiceError) {
      return res.status(error.status).json({ message: error.message });
    }
    logger.error('Error adding payment:', error);
    return res.status(500).json({ message: 'Error al registrar el pago' });
  }
};

export const getSalesStats = async (req: Request, res: Response) => {
  try {
    const { date_from, date_to, warehouse_id, summary_only } = req.query;

    const where: any = {};

    if (date_from && date_to) {
      where.sale_date = { [Op.between]: [parseLocalDate(date_from as string), parseLocalDateEnd(date_to as string)] };
    } else if (date_from) {
      where.sale_date = { [Op.gte]: parseLocalDate(date_from as string) };
    }

    if (warehouse_id) {
      where.warehouse_id = warehouse_id;
    }

    const totalSales = await Sale.count({
      where: { ...where, status: { [Op.in]: ['completed', 'pending'] } } as any
    });

    const totalRevenue = await Sale.sum('total', {
      where: {
        ...where,
        status: { [Op.in]: ['completed', 'pending'] }
      } as any
    });

    // COP total: each sale's total multiplied by its own historical exchange_rate
    const copResult = await Sale.findAll({
      where: { ...where, status: { [Op.in]: ['completed', 'pending'] } } as any,
      attributes: [[sequelize.fn('SUM', sequelize.literal('total * exchange_rate')), 'total_cop']],
      raw: true
    }) as any[];
    const totalRevenueCOP = Math.round(parseFloat(copResult[0]?.total_cop || 0));

    // Total cost from sale details (quantity × cost_price — cost_price matches quantity granularity)
    const costResult = await sequelize.query(`
      SELECT COALESCE(SUM(sd.quantity * sd.cost_price), 0) AS total_cost
      FROM sale_details sd
      INNER JOIN sales s ON s.id = sd.sale_id AND s.deleted_at IS NULL
      WHERE s.status IN ('completed', 'pending')
        AND sd.cost_price IS NOT NULL
        ${date_from && date_to ? "AND s.sale_date BETWEEN :date_from AND CONCAT(:date_to, ' 23:59:59')" : date_from ? 'AND s.sale_date >= :date_from' : ''}
        ${warehouse_id ? 'AND s.warehouse_id = :warehouse_id' : ''}
    `, {
      replacements: { date_from, date_to, warehouse_id },
      type: sequelize.QueryTypes.SELECT
    });
    const totalCost = parseFloat(costResult[0]?.total_cost || 0);
    const revenue = totalRevenue || 0;
    const grossProfit = revenue - totalCost;
    const grossMarginPct = revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0;

    // summary_only skips heavy queries (topProducts, salesByType, salesByStatus, salesByCurrency)
    if (summary_only === 'true') {
      return res.json({
        data: { totalSales, totalRevenue: revenue, totalRevenueCOP, totalCost, grossProfit, grossMarginPct }
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
    }) as any[];

    const salesByStatus = await Sale.findAll({
      where,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('Sale.id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('Sale.total')), 'total']
      ],
      group: ['status']
    }) as any[];

    const topProducts = await SaleDetail.findAll({
      attributes: [
        'product_id',
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN `SaleDetail`.`is_unit` = 1 THEN `SaleDetail`.`quantity` ELSE `SaleDetail`.`quantity` * `presentation`.`units_per_package` END')), 'total_quantity'],
        [sequelize.fn('SUM', sequelize.col('SaleDetail.total')), 'total_amount'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN `SaleDetail`.`cost_price` IS NOT NULL THEN `SaleDetail`.`quantity` * `SaleDetail`.`cost_price` ELSE 0 END')), 'total_cost']
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
      limit: parseInt(req.query.top_limit as string) || 10,
      raw: false
    }) as any[];

    // Add gross_margin_pct to each top product
    const topProductsWithMargin = topProducts.map((p: any) => {
      const json = p.toJSON();
      const amount = parseFloat(json.total_amount) || 0;
      const cost = parseFloat(json.total_cost) || 0;
      json.gross_margin_pct = amount > 0 ? Math.round(((amount - cost) / amount) * 10000) / 100 : 0;
      return json;
    });

    // Ventas por modo del POS (currency_mode): cantidad y monto nativo.
    // USD mode → total en USD; COP mode → total × exchange_rate de cada venta.
    const modeRows = await Sale.findAll({
      where: { ...where, status: { [Op.in]: ['completed', 'pending'] } } as any,
      attributes: [
        'currency_mode',
        [sequelize.fn('COUNT', sequelize.col('id')), 'sale_count'],
        [sequelize.fn('SUM', sequelize.col('total')), 'total_usd'],
        [sequelize.fn('SUM', sequelize.literal('total * exchange_rate')), 'total_cop']
      ],
      group: ['currency_mode'],
      raw: true
    }) as any[];
    const salesByMode: any = {};
    modeRows.forEach((r: any) => {
      const mode = r.currency_mode || 'USD';
      salesByMode[mode] = {
        count: parseInt(r.sale_count) || 0,
        total_usd: parseFloat(r.total_usd) || 0,
        total_cop: Math.round(parseFloat(r.total_cop) || 0)
      };
    });

    // Sales count and total by currency
    let salesByCurrency: any = {};
    if (totalSales > 0) {
      try {
        const statusWhere: any = { ...where, status: { [Op.in]: ['completed', 'pending'] } };
        const saleIds = (await Sale.findAll({ where: statusWhere, attributes: ['id'], raw: true }) as any[]).map((s: any) => s.id);
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
          }) as any[];
          currRows.forEach((r: any) => {
            salesByCurrency[r.currency || 'USD'] = {
              count: parseInt(r.sale_count) || 0,
              total: parseFloat(r.total_amount) || 0
            };
          });
        }
      } catch (e: any) {
        logger.error('Error fetching salesByCurrency:', e.message);
      }
    }

    res.json({
      data: {
        totalSales,
        totalRevenue: revenue,
        totalRevenueCOP,
        totalCost,
        grossProfit,
        grossMarginPct,
        salesByType,
        salesByStatus,
        topProducts: topProductsWithMargin,
        salesByCurrency,
        salesByMode
      }
    });

  } catch (error) {
    logger.error('Error fetching sales stats:', error);
    res.status(500).json({
      message: 'Error al obtener estadísticas de ventas'
    });
  }
};

export const getDailySeries = async (req: Request, res: Response) => {
  try {
    const { date_from, date_to } = req.query;
    const dateTo = (date_to as string) || localToday();
    const dateFrom = (date_from as string) || (() => { const d = new Date(); d.setDate(d.getDate() - 30); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

    const rows = await sequelize.query(`
      SELECT
        ds.date,
        ds.sale_count,
        ds.total_usd,
        ds.total_cop,
        ROUND(COALESCE(dc.total_cost, 0), 2) AS total_cost,
        ROUND(ds.total_usd - COALESCE(dc.total_cost, 0), 2) AS gross_profit
      FROM (
        SELECT
          DATE(s.sale_date) AS date,
          COUNT(*) AS sale_count,
          ROUND(SUM(s.total), 2) AS total_usd,
          ROUND(SUM(s.total * s.exchange_rate)) AS total_cop
        FROM sales s
        WHERE s.status IN ('completed', 'pending')
          AND s.sale_type != 'pos_pending'
          AND s.deleted_at IS NULL
          AND s.sale_date >= :dateFrom AND s.sale_date < DATE_ADD(:dateTo, INTERVAL 1 DAY)
        GROUP BY DATE(s.sale_date)
      ) ds
      LEFT JOIN (
        SELECT
          DATE(s.sale_date) AS date,
          SUM(
            CASE WHEN sd.cost_price IS NOT NULL
              THEN sd.quantity * sd.cost_price
            ELSE 0 END
          ) AS total_cost
        FROM sale_details sd
        INNER JOIN sales s ON s.id = sd.sale_id
          AND s.status IN ('completed', 'pending')
          AND s.sale_type != 'pos_pending'
          AND s.deleted_at IS NULL
          AND s.sale_date >= :dateFrom AND s.sale_date < DATE_ADD(:dateTo, INTERVAL 1 DAY)
        GROUP BY DATE(s.sale_date)
      ) dc ON dc.date = ds.date
      ORDER BY ds.date ASC
    `, {
      replacements: { dateFrom, dateTo },
      type: sequelize.QueryTypes.SELECT
    });

    const data = rows.map((r: any) => ({
      date: r.date,
      sale_count: parseInt(r.sale_count),
      total_usd: parseFloat(r.total_usd),
      total_cop: parseInt(r.total_cop),
      total_cost: parseFloat(r.total_cost),
      gross_profit: parseFloat(r.gross_profit)
    }));

    res.json({ data });
  } catch (error) {
    logger.error('Error fetching daily series:', error);
    res.status(500).json({
      message: 'Error al obtener serie diaria de ventas'
    });
  }
};

export const getProductSales = async (req: Request, res: Response) => {
  try {
    const { date_from, date_to } = req.query;

    const where: any = {
      status: { [Op.in]: ['completed', 'pending'] }
    };

    if (date_from && date_to) {
      where.sale_date = { [Op.between]: [parseLocalDate(date_from as string), parseLocalDateEnd(date_to as string)] };
    } else if (date_from) {
      where.sale_date = { [Op.gte]: parseLocalDate(date_from as string) };
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
    }) as any[];

    res.json({ data: productSales, count: productSales.length });
  } catch (error) {
    logger.error('Error fetching product sales:', error);
    res.status(500).json({
      message: 'Error al obtener ventas por producto'
    });
  }
};

export const getDailyClosure = async (req: Request, res: Response) => {
  try {
    const { date, user_id } = req.query;

    // Parse date in local timezone (new Date('YYYY-MM-DD') parses as UTC, causing off-by-one)
    let targetDate: Date;
    if (date) {
      const [y, m, d] = (date as string).split('-').map(Number);
      targetDate = new Date(y, m - 1, d);
    } else {
      targetDate = new Date();
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // === SALES STATS (by sale_date) ===
    const salesWhere: any = {
      sale_date: { [Op.between]: [startOfDay, endOfDay] },
      status: { [Op.in]: ['completed', 'pending'] },
      sale_type: { [Op.ne]: 'pos_pending' }
    };
    if (user_id) salesWhere.user_id = user_id;

    const grossSalesUSD = await Sale.sum('total', { where: salesWhere }) || 0;
    const copResult = await Sale.findOne({
      where: salesWhere,
      attributes: [[sequelize.literal('SUM(total * exchange_rate)'), 'totalCOP']],
      raw: true
    }) as any;
    const grossSalesCOP = parseFloat(copResult?.totalCOP) || 0;
    const salesCount = await Sale.count({ where: salesWhere });

    // Subtract applied credit notes for today's sales (partial + full returns)
    const cnDeductionResult = await sequelize.query(
      `SELECT
         COALESCE(SUM(cn.total), 0) AS deduction_usd,
         COALESCE(SUM(cn.total * cn.exchange_rate), 0) AS deduction_cop
       FROM credit_notes cn
       JOIN sales s ON s.id = cn.sale_id
       WHERE cn.status = 'applied'
         AND s.sale_date BETWEEN :startOfDay AND :endOfDay
         AND s.status IN ('completed', 'pending', 'returned')
         AND s.sale_type != 'pos_pending'
         ${user_id ? 'AND s.user_id = :user_id' : ''}`,
      {
        replacements: { startOfDay, endOfDay, ...(user_id ? { user_id } : {}) },
        type: sequelize.QueryTypes.SELECT
      }
    );
    const cnRow = (cnDeductionResult as any[])[0] || {};
    const cnDeductionUSD = parseFloat(cnRow.deduction_usd || 0);
    const cnDeductionCOP = parseFloat(cnRow.deduction_cop || 0);
    const totalSalesUSD = grossSalesUSD - cnDeductionUSD;
    const totalSalesCOP = grossSalesCOP - cnDeductionCOP;

    // Credit extended today (total - paid_amount for credit/mixed sales)
    const creditResult = await Sale.findOne({
      where: { ...salesWhere, sale_type: { [Op.in]: ['credit', 'mixed'] } },
      attributes: [[sequelize.literal('SUM(total - paid_amount)'), 'creditTotal']],
      raw: true
    }) as any;
    const creditTotalUSD = parseFloat(creditResult?.creditTotal) || 0;

    // === PAYMENTS BREAKDOWN (only today's cash/mixed sales, not credit sales) ===
    // Incluye ventas 'returned': su pago sí entró a caja y la devolución en
    // efectivo ya se descuenta aparte en cashRefunds — excluirlas restaba doble.
    const todaySaleIds = (await Sale.findAll({
      where: {
        ...salesWhere,
        status: { [Op.in]: ['completed', 'pending', 'returned'] },
        sale_type: { [Op.in]: ['cash', 'mixed'] }
      },
      attributes: ['id']
    }) as any[]).map((s: any) => s.id);

    const paymentsBreakdown: any = {};

    if (todaySaleIds.length > 0) {
      const paymentWhere: any = {
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
      }) as any[];

      payments.forEach((p: any) => {
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
      }) as any[];

      salesByCurrency.forEach((r: any) => {
        const curr = r.currency || 'USD';
        if (paymentsBreakdown[curr]) {
          paymentsBreakdown[curr]._salesCount = parseInt(r.sale_count) || 0;
        }
      });
    }

    // === CREDIT COLLECTIONS (payments today for old credit/mixed sales) ===
    const creditCollectionWhere: any = {
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
        } as any,
        attributes: []
      }],
      attributes: [
        'currency',
        [sequelize.fn('SUM', sequelize.col('SalePayment.amount')), 'total_amount']
      ],
      group: ['currency'],
      raw: true
    }) as any[];

    const creditCollectedByCurrency: any = {};
    creditCollections.forEach((c: any) => {
      creditCollectedByCurrency[c.currency || 'USD'] = parseFloat(c.total_amount) || 0;
    });

    // === CASH REFUNDS FROM CREDIT NOTES (devoluciones en efectivo) ===
    // ALL cash refunds are physically given in COP regardless of sale currency.
    // cn.total is in USD, cn.exchange_rate converts to COP at the time of refund.
    const toUtcSql = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
    const cashRefundResult = await sequelize.query(
      `SELECT
         COALESCE(SUM(cn.total * cn.exchange_rate), 0) AS refund_cop,
         COALESCE(SUM(cn.total), 0) AS refund_usd,
         COUNT(*) AS refund_count
       FROM credit_notes cn
       WHERE cn.status = 'applied'
         AND cn.refund_method = 'cash'
         AND cn.approved_at BETWEEN :startOfDay AND :endOfDay
         ${user_id ? 'AND cn.created_by = :user_id' : ''}`,
      {
        replacements: { startOfDay: toUtcSql(startOfDay), endOfDay: toUtcSql(endOfDay), ...(user_id ? { user_id } : {}) },
        type: sequelize.QueryTypes.SELECT
      }
    );
    const refundRow = (cashRefundResult as any[])[0] || {};
    const totalRefundCOP = Math.round(parseFloat(refundRow.refund_cop || 0));
    const totalRefundUSD = parseFloat(refundRow.refund_usd || 0);
    const totalRefundCount = parseInt(refundRow.refund_count || 0);
    const cashRefunds = {
      refund_cop: totalRefundCOP,
      refund_usd: totalRefundUSD,
      refund_count: totalRefundCount,
      refund_by_currency: { COP: totalRefundCOP } as Record<string, number>
    };

    // Pending POS sales (vendedor-created, awaiting cashier collection)
    const posPendingWhere: any = {
      sale_date: { [Op.between]: [startOfDay, endOfDay] },
      sale_type: 'pos_pending',
      status: 'pending'
    };
    if (user_id) posPendingWhere.user_id = user_id;
    const posPendingCount = await Sale.count({ where: posPendingWhere });
    const posPendingTotal = await Sale.sum('total', { where: posPendingWhere }) || 0;

    res.json({
      data: {
        date: `${startOfDay.getFullYear()}-${String(startOfDay.getMonth()+1).padStart(2,'0')}-${String(startOfDay.getDate()).padStart(2,'0')}`,
        totalSalesUSD,
        totalSalesCOP: Math.round(totalSalesCOP),
        grossSalesUSD,
        grossSalesCOP: Math.round(grossSalesCOP),
        cnDeductionUSD,
        cnDeductionCOP: Math.round(cnDeductionCOP),
        salesCount,
        creditTotalUSD,
        paymentsBreakdown,
        creditCollectedByCurrency,
        cashRefunds,
        posPending: {
          count: posPendingCount,
          totalUSD: posPendingTotal
        }
      }
    });

  } catch (error) {
    logger.error('Error generating daily closure:', error);
    res.status(500).json({
      message: 'Error al generar el cierre de caja'
    });
  }
};

// Validate credit PIN against admin users
export const validateCreditPin = async (req: Request, res: Response) => {
  try {
    const { pin } = req.body;

    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ message: 'PIN debe ser de 4 a 6 dígitos' });
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
        message: 'No hay administradores con PIN configurado'
      });
    }

    for (const admin of admins as any[]) {
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
          admin_id: admin.id,
          admin_name: `${admin.first_name} ${admin.last_name}`
        });
      }
    }

    // No match — increment attempts for all non-locked admins
    for (const admin of admins as any[]) {
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
    const allLocked = (admins as any[]).every((a: any) => {
      const attempts = (a.credit_pin_attempts || 0) + 1;
      return attempts >= 3 || (a.credit_pin_locked_until && new Date(a.credit_pin_locked_until) > new Date());
    });

    return res.status(400).json({
      message: allLocked
        ? 'PIN bloqueado por demasiados intentos. Intente en 15 minutos.'
        : 'PIN incorrecto'
    });
  } catch (error) {
    logger.error('Error validating credit PIN:', error);
    res.status(500).json({ message: 'Error al validar PIN' });
  }
};

// GET /api/sales/summary?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
export const getSalesSummary = async (req: Request, res: Response) => {
  try {
    const { date_from, date_to } = req.query;
    const today = new Date();
    const dateFrom = date_from || `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const dateTo = date_to || dateFrom;

    // Ventana en medianoche local convertida a UTC (los DATETIME se guardan en
    // UTC vía ORM) para que "el día" del resumen coincida con el del cierre;
    // con strings crudos, las ventas/abonos nocturnos caían en el día siguiente.
    // Nota: en raw queries sequelize serializa Date en hora local (a diferencia
    // del ORM, que usa UTC), por eso se pasan strings UTC explícitos.
    const [fy, fm, fd] = (dateFrom as string).split('-').map(Number);
    const [ty, tm, td] = (dateTo as string).split('-').map(Number);
    const toUtcSql = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
    const startWin = toUtcSql(new Date(fy, fm - 1, fd, 0, 0, 0, 0));
    const endWin = toUtcSql(new Date(ty, tm - 1, td, 23, 59, 59, 999));

    const replacements: any = { dateFrom, dateTo, startWin, endWin };
    const statusFilter = "s.status IN ('completed','pending')";
    const dateFilter = "s.sale_date BETWEEN :startWin AND :endWin";

    // --- Summary + sales_by_type ---
    const [summaryRow] = await sequelize.query(`
      SELECT
        COUNT(*) as sale_count,
        COALESCE(SUM(s.total), 0) as total_sales_usd,
        COALESCE(SUM(s.total * s.exchange_rate), 0) as total_sales_cop,
        COALESCE(SUM(s.paid_amount), 0) as total_paid_usd,
        COALESCE(SUM(s.total - s.paid_amount), 0) as total_credit_usd,
        COALESCE(SUM(CASE WHEN s.sale_type='cash' THEN 1 ELSE 0 END), 0) as cash_count,
        COALESCE(SUM(CASE WHEN s.sale_type='cash' THEN s.total ELSE 0 END), 0) as cash_total,
        COALESCE(SUM(CASE WHEN s.sale_type='credit' THEN 1 ELSE 0 END), 0) as credit_count,
        COALESCE(SUM(CASE WHEN s.sale_type='credit' THEN s.total ELSE 0 END), 0) as credit_total,
        COALESCE(SUM(CASE WHEN s.sale_type='mixed' THEN 1 ELSE 0 END), 0) as mixed_count,
        COALESCE(SUM(CASE WHEN s.sale_type='mixed' THEN s.total ELSE 0 END), 0) as mixed_total,
        COALESCE(SUM(CASE WHEN s.sale_type='pos_pending' THEN 1 ELSE 0 END), 0) as pos_pending_count,
        COALESCE(SUM(CASE WHEN s.sale_type='pos_pending' THEN s.total ELSE 0 END), 0) as pos_pending_total
      FROM sales s
      WHERE ${statusFilter} AND ${dateFilter}
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const sr: any = summaryRow || {};

    // --- Payments by currency (cash/mixed sales only) ---
    const paymentRows = await sequelize.query(`
      SELECT
        sp.currency,
        sp.payment_method,
        SUM(sp.amount) as total_amount,
        COUNT(DISTINCT sp.sale_id) as sale_count
      FROM sale_payments sp
      JOIN sales s ON s.id = sp.sale_id
      WHERE ${statusFilter} AND ${dateFilter}
        AND s.sale_type IN ('cash','mixed')
      GROUP BY sp.currency, sp.payment_method
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const payments_by_currency: any = {};
    for (const row of paymentRows as any[]) {
      const curr = row.currency || 'USD';
      if (!payments_by_currency[curr]) {
        payments_by_currency[curr] = { sales_count: 0, cash: 0, transfer: 0, usdt: 0, total: 0 };
      }
      const amount = parseFloat(row.total_amount) || 0;
      const method = row.payment_method === 'usdt' ? 'usdt' : (row.payment_method === 'cash' ? 'cash' : 'transfer');
      payments_by_currency[curr][method] += amount;
      payments_by_currency[curr].total += amount;
    }
    // Sales count per currency (distinct)
    const currSalesCounts = await sequelize.query(`
      SELECT
        sp.currency,
        COUNT(DISTINCT sp.sale_id) as sale_count
      FROM sale_payments sp
      JOIN sales s ON s.id = sp.sale_id
      WHERE ${statusFilter} AND ${dateFilter}
        AND s.sale_type IN ('cash','mixed')
      GROUP BY sp.currency
    `, { replacements, type: sequelize.QueryTypes.SELECT });
    for (const row of currSalesCounts as any[]) {
      const curr = row.currency || 'USD';
      if (payments_by_currency[curr]) {
        payments_by_currency[curr].sales_count = parseInt(row.sale_count) || 0;
      }
    }

    // --- Credit: given today + collections by currency ---
    // total_credit_usd = SUM(total - paid_amount) already covers credit + mixed
    const creditGivenUSD = parseFloat(sr.total_credit_usd) || 0;

    // Credit collections: payments today for credit sales, or old mixed sales
    const creditCollections = await sequelize.query(`
      SELECT
        sp.currency,
        SUM(sp.amount) as total_amount
      FROM sale_payments sp
      JOIN sales s ON s.id = sp.sale_id
      WHERE s.status IN ('completed','pending')
        AND sp.payment_date BETWEEN :startWin AND :endWin
        AND (
          s.sale_type = 'credit'
          OR (s.sale_type = 'mixed' AND s.sale_date < :startWin)
        )
      GROUP BY sp.currency
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const collected_by_currency: any = {};
    for (const row of creditCollections as any[]) {
      collected_by_currency[row.currency || 'USD'] = parseFloat(row.total_amount) || 0;
    }

    // --- Top products (array, top 10) ---
    const topProducts = await sequelize.query(`
      SELECT
        p.name as product_name,
        SUM(sd.quantity) as total_quantity,
        SUM(sd.total) as total_revenue_usd
      FROM sale_details sd
      JOIN sales s ON s.id = sd.sale_id
      JOIN products p ON p.id = sd.product_id
      WHERE ${statusFilter} AND ${dateFilter}
      GROUP BY sd.product_id, p.name
      ORDER BY total_revenue_usd DESC
      LIMIT 10
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    res.json({
      data: {
        period: { from: dateFrom, to: dateTo },
        summary: {
          sale_count: parseInt(sr.sale_count) || 0,
          total_sales_usd: parseFloat(sr.total_sales_usd) || 0,
          total_sales_cop: Math.round(parseFloat(sr.total_sales_cop) || 0),
          total_paid_usd: parseFloat(sr.total_paid_usd) || 0,
          total_credit_usd: parseFloat(sr.total_credit_usd) || 0,
          sales_by_type: {
            cash: { count: parseInt(sr.cash_count) || 0, total_usd: parseFloat(sr.cash_total) || 0 },
            credit: { count: parseInt(sr.credit_count) || 0, total_usd: parseFloat(sr.credit_total) || 0 },
            mixed: { count: parseInt(sr.mixed_count) || 0, total_usd: parseFloat(sr.mixed_total) || 0 },
            pos_pending: { count: parseInt(sr.pos_pending_count) || 0, total_usd: parseFloat(sr.pos_pending_total) || 0 }
          }
        },
        payments_by_currency,
        credit: {
          given_usd: creditGivenUSD,
          collected_by_currency
        },
        top_products: topProducts || []
      }
    });
  } catch (error) {
    logger.error('Error getting sales summary:', error);
    res.status(500).json({ message: 'Error al obtener resumen de ventas' });
  }
};

export const getCommissions = async (req: Request, res: Response) => {
  try {
    const { from, to, user_id, detail } = req.query as Record<string, string | undefined>;

    const dateFrom = from ? parseLocalDate(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dateTo = to ? parseLocalDateEnd(to) : new Date();

    const replacements: Record<string, unknown> = { dateFrom, dateTo };
    let userFilter = '';
    if (user_id) {
      userFilter = 'AND s.user_id = :user_id';
      replacements.user_id = parseInt(user_id, 10);
    }

    // Total por vendedor (excluye ventas canceladas y soft-deleted)
    const byVendedor = await sequelize.query(`
      SELECT
        s.user_id,
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS full_name,
        COUNT(DISTINCT s.id) AS sale_count,
        ROUND(COALESCE(SUM(sd.commission_amount), 0), 2) AS total_commission_cop
      FROM sale_details sd
      INNER JOIN sales s ON s.id = sd.sale_id AND s.deleted_at IS NULL
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.status != 'cancelled'
        AND s.sale_date BETWEEN :dateFrom AND :dateTo
        ${userFilter}
      GROUP BY s.user_id, u.first_name, u.last_name
      ORDER BY total_commission_cop DESC
    `, { replacements, type: sequelize.QueryTypes.SELECT }) as any[];

    const totalCommission = byVendedor.reduce((acc, v) => acc + (parseFloat(v.total_commission_cop) || 0), 0);

    // Desglose por producto (opcional, para ver la composición de la comisión)
    let productDetail: any[] = [];
    if (detail === 'true') {
      productDetail = await sequelize.query(`
        SELECT
          s.user_id,
          CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS full_name,
          sd.product_id,
          p.name AS product_name,
          COUNT(DISTINCT s.id) AS sale_count,
          SUM(CASE WHEN sd.is_unit = 1 THEN sd.quantity ELSE 0 END) AS units_sold,
          SUM(CASE WHEN sd.is_unit = 0 THEN sd.quantity ELSE 0 END) AS packages_sold,
          ROUND(COALESCE(SUM(sd.commission_amount), 0), 2) AS total_commission_cop
        FROM sale_details sd
        INNER JOIN sales s ON s.id = sd.sale_id AND s.deleted_at IS NULL
        INNER JOIN users u ON u.id = s.user_id
        INNER JOIN products p ON p.id = sd.product_id
        WHERE s.status != 'cancelled'
          AND s.sale_date BETWEEN :dateFrom AND :dateTo
          ${userFilter}
        GROUP BY s.user_id, u.first_name, u.last_name, sd.product_id, p.name
        ORDER BY total_commission_cop DESC
      `, { replacements, type: sequelize.QueryTypes.SELECT }) as any[];
    }

    res.json({
      data: {
        period: {
          from: dateFrom,
          to: dateTo
        },
        currency: 'COP',
        summary: {
          total_commission_cop: Math.round(totalCommission),
          vendedor_count: byVendedor.length
        },
        by_vendedor: byVendedor.map((v) => ({
          user_id: v.user_id,
          full_name: v.full_name,
          sale_count: parseInt(v.sale_count) || 0,
          total_commission_cop: Math.round(parseFloat(v.total_commission_cop) || 0)
        })),
        detail: productDetail.map((d) => ({
          user_id: d.user_id,
          full_name: d.full_name,
          product_id: d.product_id,
          product_name: d.product_name,
          sale_count: parseInt(d.sale_count) || 0,
          units_sold: parseInt(d.units_sold) || 0,
          packages_sold: parseInt(d.packages_sold) || 0,
          total_commission_cop: Math.round(parseFloat(d.total_commission_cop) || 0)
        }))
      }
    });
  } catch (error) {
    logger.error('Error getting commissions:', error);
    res.status(500).json({ message: 'Error al obtener comisiones' });
  }
};
