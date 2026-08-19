import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';

import Delivery from '../models/Delivery';
import DeliveryDetail from '../models/DeliveryDetail';
import Sale from '../models/Sale';
import SaleDetail from '../models/SaleDetail';
import Customer from '../models/Customer';
import Warehouse from '../models/Warehouse';
import Product from '../models/Product';
import ProductPresentation from '../models/ProductPresentation';
import User from '../models/User';

const logger = require('../config/logger');
const { sequelize } = require('../config/database');
const { getDeliveryStats: _getDeliveryStats } = require('../services/delivery.service');

/**
 * Generate unique delivery number
 * Format: ENT-YYYYMMDD-####
 */
const generateDeliveryNumber = async (): Promise<string> => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const prefix = `ENT-${dateStr}`;

  // Find the last delivery number for today
  const lastDelivery = await Delivery.findOne({
    where: {
      delivery_number: {
        [Op.like]: `${prefix}%`
      }
    },
    order: [['delivery_number', 'DESC']]
  }) as any;

  let sequence = 1;
  if (lastDelivery) {
    const lastSequence = parseInt(lastDelivery.delivery_number.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `${prefix}-${String(sequence).padStart(4, '0')}`;
};

/**
 * Get all deliveries with filters
 * GET /api/deliveries
 */
export const getAllDeliveries = async (req: Request, res: Response) => {
  try {
    const {
      page: pageStr = '1',
      limit: limitStr = '20',
      search = '',
      status,
      customer_id,
      date_from,
      date_to,
      sort_by,
      sort_dir = 'DESC'
    } = req.query as Record<string, string>;

    const page = parseInt(pageStr, 10);
    const limit = parseInt(limitStr, 10);
    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Search by delivery number or tracking number
    if (search) {
      where[Op.or] = [
        { delivery_number: { [Op.like]: `%${search}%` } },
        { tracking_number: { [Op.like]: `%${search}%` } }
      ];
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by customer
    if (customer_id) {
      where.customer_id = customer_id;
    }

    // Filter by date range
    if (date_from || date_to) {
      where.scheduled_date = {};
      if (date_from) {
        where.scheduled_date[Op.gte] = date_from;
      }
      if (date_to) {
        where.scheduled_date[Op.lte] = date_to;
      }
    }

    // Query deliveries
    const { count, rows } = await Delivery.findAndCountAll({
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
          paranoid: false,
          attributes: ['id', 'first_name', 'last_name', 'business_name', 'type', 'email', 'phone']
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
          as: 'deliverer',
          attributes: ['id', 'username', 'first_name', 'last_name'],
          required: false
        }
      ],
      order: sort_by ? [[sort_by, (sort_dir.toUpperCase() as string)]] : [['scheduled_date', 'DESC'], ['created_at', 'DESC']],
      limit: limit,
      offset
    });

    res.json({
      data: rows,
      pagination: {
        total: count,
        page: page,
        limit: limit,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching deliveries', { error: (error as Error).message });
    res.status(500).json({
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Get delivery by ID
 * GET /api/deliveries/:id
 */
export const getDeliveryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const delivery = await Delivery.findByPk(id, {
      include: [
        {
          model: Sale,
          as: 'sale',
          attributes: ['id', 'sale_number', 'sale_date', 'total', 'payment_method']
        },
        {
          model: Customer,
          as: 'customer',
          paranoid: false,
          attributes: ['id', 'first_name', 'last_name', 'business_name', 'type', 'email', 'phone', 'address']
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
          as: 'deliverer',
          attributes: ['id', 'username', 'first_name', 'last_name'],
          required: false
        },
        {
          model: DeliveryDetail,
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
            }
          ]
        }
      ]
    }) as any;

    if (!delivery) {
      return res.status(404).json({
        message: 'Entrega no encontrada'
      });
    }

    res.json({
      data: delivery
    });
  } catch (error) {
    logger.error('Error fetching delivery', { error: (error as Error).message });
    res.status(500).json({
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Create a new delivery from a sale
 * POST /api/deliveries
 */
export const createDelivery = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      sale_id,
      scheduled_date,
      delivery_address,
      delivery_city,
      delivery_state,
      contact_name,
      contact_phone,
      delivery_method,
      carrier,
      tracking_number,
      notes
    } = req.body;

    // Validate required fields
    if (!sale_id || !delivery_address || !delivery_method) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Faltan campos requeridos: sale_id, delivery_address, delivery_method'
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
    }) as any;

    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Venta no encontrada'
      });
    }

    // Check if sale already has a delivery
    const existingDelivery = await Delivery.findOne({
      where: { sale_id },
      transaction
    }) as any;

    if (existingDelivery) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Esta venta ya tiene una entrega asociada'
      });
    }

    // Generate delivery number
    const delivery_number = await generateDeliveryNumber();

    // Create delivery
    const delivery = await Delivery.create({
      delivery_number,
      sale_id,
      customer_id: sale.customer_id,
      warehouse_id: sale.warehouse_id,
      scheduled_date: scheduled_date || new Date(),
      delivery_address,
      delivery_city: delivery_city || null,
      delivery_state: delivery_state || null,
      contact_name: contact_name || null,
      contact_phone: contact_phone || null,
      status: 'pending',
      delivery_method,
      carrier: carrier || null,
      tracking_number: tracking_number || null,
      notes: notes || null,
      created_by: (req as any).user.id
    }, { transaction }) as any;

    // Create delivery details from sale details
    if (sale.details) {
      for (const saleDetail of sale.details) {
        await DeliveryDetail.create({
          delivery_id: delivery.id,
          sale_detail_id: saleDetail.id,
          product_id: saleDetail.product_id,
          presentation_id: saleDetail.presentation_id,
          package_quantity_delivered: saleDetail.package_quantity,
          loose_units_delivered: saleDetail.loose_units
        }, { transaction });
      }
    }

    await transaction.commit();

    // Fetch complete delivery
    const createdDelivery = await Delivery.findByPk(delivery.id, {
      include: [
        {
          model: Sale,
          as: 'sale',
          attributes: ['id', 'sale_number', 'sale_date']
        },
        {
          model: Customer,
          as: 'customer',
          paranoid: false,
          attributes: ['id', 'first_name', 'last_name', 'business_name', 'type', 'email']
        },
        {
          model: DeliveryDetail,
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
    }) as any;

    res.status(201).json({
      message: 'Entrega creada exitosamente',
      data: createdDelivery
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error creating delivery', { error: (error as Error).message });
    res.status(500).json({
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Update delivery information
 * PUT /api/deliveries/:id
 */
export const updateDelivery = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      scheduled_date,
      delivery_address,
      delivery_city,
      delivery_state,
      contact_name,
      contact_phone,
      carrier,
      tracking_number,
      notes
    } = req.body;

    // Find delivery
    const delivery = await Delivery.findByPk(id, { transaction }) as any;

    if (!delivery) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Entrega no encontrada'
      });
    }

    // Can only update if status is pending or in_transit
    if (!['pending', 'in_transit'].includes(delivery.status)) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Solo se pueden actualizar entregas en estado pendiente o en tránsito'
      });
    }

    // Update delivery
    await delivery.update({
      scheduled_date: scheduled_date || delivery.scheduled_date,
      delivery_address: delivery_address || delivery.delivery_address,
      delivery_city: delivery_city !== undefined ? delivery_city : delivery.delivery_city,
      delivery_state: delivery_state !== undefined ? delivery_state : delivery.delivery_state,
      contact_name: contact_name !== undefined ? contact_name : delivery.contact_name,
      contact_phone: contact_phone !== undefined ? contact_phone : delivery.contact_phone,
      carrier: carrier !== undefined ? carrier : delivery.carrier,
      tracking_number: tracking_number !== undefined ? tracking_number : delivery.tracking_number,
      notes: notes !== undefined ? notes : delivery.notes
    }, { transaction });

    await transaction.commit();

    // Fetch updated delivery
    const updatedDelivery = await Delivery.findByPk(id, {
      include: [
        {
          model: Sale,
          as: 'sale',
          attributes: ['id', 'sale_number']
        },
        {
          model: Customer,
          as: 'customer',
          paranoid: false,
          attributes: ['id', 'first_name', 'last_name', 'business_name', 'type', 'email']
        }
      ]
    }) as any;

    res.json({
      message: 'Entrega actualizada exitosamente',
      data: updatedDelivery
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error updating delivery', { error: (error as Error).message });
    res.status(500).json({
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Mark delivery as in transit
 * POST /api/deliveries/:id/in-transit
 */
export const markAsInTransit = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    // Find delivery
    const delivery = await Delivery.findByPk(id, { transaction }) as any;

    if (!delivery) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Entrega no encontrada'
      });
    }

    // Validate status
    if (delivery.status !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Solo se pueden marcar como en tránsito las entregas pendientes'
      });
    }

    // Update status
    await delivery.update({
      status: 'in_transit'
    }, { transaction });

    await transaction.commit();

    res.json({
      message: 'Entrega marcada como en tránsito'
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error marking delivery as in transit', { error: (error as Error).message });
    res.status(500).json({
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Confirm delivery as delivered
 * POST /api/deliveries/:id/confirm
 */
export const confirmDelivery = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { delivery_date, signature_image_url } = req.body;

    // Find delivery
    const delivery = await Delivery.findByPk(id, { transaction }) as any;

    if (!delivery) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Entrega no encontrada'
      });
    }

    // Validate status
    if (!['pending', 'in_transit'].includes(delivery.status)) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Solo se pueden confirmar entregas pendientes o en tránsito'
      });
    }

    // Update delivery
    await delivery.update({
      status: 'delivered',
      delivery_date: delivery_date || new Date(),
      delivered_by: (req as any).user.id,
      delivered_at: new Date(),
      signature_image_url: signature_image_url || null
    }, { transaction });

    // Auto-update Sale status to 'delivered' when delivery is confirmed
    if (delivery.sale_id) {
      await Sale.update(
        { status: 'delivered' },
        { where: { id: delivery.sale_id }, transaction }
      );
    }

    await transaction.commit();

    res.json({
      message: 'Entrega confirmada exitosamente'
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error confirming delivery', { error: (error as Error).message });
    res.status(500).json({
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Cancel a delivery
 * POST /api/deliveries/:id/cancel
 */
export const cancelDelivery = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    // Find delivery
    const delivery = await Delivery.findByPk(id, { transaction }) as any;

    if (!delivery) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Entrega no encontrada'
      });
    }

    // Can't cancel delivered deliveries
    if (delivery.status === 'delivered') {
      await transaction.rollback();
      return res.status(400).json({
        message: 'No se puede cancelar una entrega ya completada'
      });
    }

    if (delivery.status === 'cancelled') {
      await transaction.rollback();
      return res.status(400).json({
        message: 'La entrega ya está cancelada'
      });
    }

    // Update delivery
    await delivery.update({
      status: 'cancelled',
      notes: delivery.notes ? `${delivery.notes}\n\nMotivo de cancelación: ${cancellation_reason}` : `Motivo de cancelación: ${cancellation_reason}`
    }, { transaction });

    await transaction.commit();

    res.json({
      message: 'Entrega cancelada exitosamente'
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error cancelling delivery', { error: (error as Error).message });
    res.status(500).json({
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Get delivery statistics
 * GET /api/deliveries/stats
 */
export const getDeliveryStats = async (req: Request, res: Response) => {
  try {
    const { date_from, date_to } = req.query as Record<string, string>;
    const data = await _getDeliveryStats({ date_from, date_to });
    res.json({ data });
  } catch (error) {
    logger.error('Error fetching delivery stats', { error: (error as Error).message });
    res.status(500).json({
      message: 'Error interno del servidor'
    });
  }
};