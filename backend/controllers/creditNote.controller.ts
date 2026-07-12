// Express type imports (ALWAYS at the top)
import { Request, Response } from 'express';

// Sequelize imports (only what is used in the controller)
import { Op } from 'sequelize';

// Model imports (esModuleInterop — require with export = in the .ts files)
import CreditNote from '../models/CreditNote';
import CreditNoteDetail from '../models/CreditNoteDetail';
import Sale from '../models/Sale';
import SaleDetail from '../models/SaleDetail';
import Customer from '../models/Customer';
import Warehouse from '../models/Warehouse';
import Product from '../models/Product';
import ProductPresentation from '../models/ProductPresentation';
import Batch from '../models/Batch';
import Inventory from '../models/Inventory';
import InventoryMovement from '../models/InventoryMovement';
import User from '../models/User';

// Other requires that are not models/sequelize/express → leave as require()
const logger = require('../config/logger');
const { sequelize } = require('../config/database');
const { getCreditNoteStats: _getCNStats } = require('../services/creditNote.service');

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
  }) as any;

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
export const getAllCreditNotes = async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      search = '',
      customer_id,
      sale_id,
      status,
      date_from,
      date_to,
      sort_by,
      sort_dir = 'DESC'
    } = req.query as Record<string, string>;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where: any = {};

    // Search by credit note number
    if (search) {
      where.credit_note_number = { [Op.like]: `%${search}%` };
    }

    // Filter by customer
    if (customer_id) {
      where.customer_id = customer_id;
    }

    // Filter by sale
    if (sale_id) {
      where.sale_id = sale_id;
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by date range
    if (date_from || date_to) {
      where.credit_note_date = {};
      if (date_from) {
        where.credit_note_date[Op.gte] = date_from;
      }
      if (date_to) {
        where.credit_note_date[Op.lte] = date_to;
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
          attributes: ['id', 'first_name', 'last_name', 'business_name', 'trade_name', 'type', 'document_type', 'document_number', 'email', 'phone']
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
        },
        {
          model: CreditNoteDetail,
          as: 'details',
          required: false,
          include: [
            {
              model: ProductPresentation,
              as: 'presentation',
              attributes: ['id', 'units_per_package']
            }
          ]
        }
      ],
      order: sort_by ? [[sort_by, sort_dir.toUpperCase()] as [string, string]] : [['credit_note_date', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
      distinct: true
    }) as any;

    res.json({
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching credit notes', { error: (error as Error).message });
    res.status(500).json({
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Get credit note by ID
 * GET /api/credit-notes/:id
 */
export const getCreditNoteById = async (req: Request, res: Response) => {
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
              attributes: ['id', 'batch_number', 'expiration_date'],
              required: false
            }
          ]
        }
      ]
    }) as any;

    if (!creditNote) {
      return res.status(404).json({
        message: 'Nota de crédito no encontrada'
      });
    }

    res.json({
      data: creditNote
    });
  } catch (error) {
    logger.error('Error fetching credit note', { error: (error as Error).message });
    res.status(500).json({
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Create a new credit note
 * POST /api/credit-notes
 */
export const createCreditNote = async (req: Request, res: Response) => {
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
    }) as any;

    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Venta no encontrada'
      });
    }

    // Validate refund method vs customer type
    if (refund_method === 'credit_balance' && !sale.customer_id) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'El Consumidor Final no tiene monedero. Seleccione otro método de reembolso.'
      });
    }

    // Generate credit note number
    const credit_note_number = await generateCreditNoteNumber();

    // Calculate totals
    let subtotal = 0;
    let tax_amount = 0;
    const creditNoteDetails: any[] = [];

    for (const item of items) {
      const saleDetail = sale.details.find((d: any) => d.id === item.sale_detail_id);

      if (!saleDetail) {
        await transaction.rollback();
        return res.status(400).json({
          message: `Detalle de venta ${item.sale_detail_id} no encontrado en la venta`
        });
      }

      // Effective uph: 1 when sold by individual unit, actual uph when sold by package
      const uph = parseFloat(saleDetail.presentation.units_per_package) || 1;
      const effectiveUph = saleDetail.is_unit ? 1 : uph;

      // Total units returned in base units (for inventory and validation)
      const unitsReturned = (item.package_quantity_returned * effectiveUph) + item.loose_units_returned;

      // Total units sold in base units
      const unitsSold = saleDetail.is_unit
        ? parseFloat(saleDetail.quantity)
        : parseFloat(saleDetail.quantity) * uph;

      // Check how many units were already returned for this sale detail in applied credit notes
      const returnedRows = await sequelize.query(
        `SELECT COALESCE(SUM(cnd.package_quantity_returned * :uph + cnd.loose_units_returned), 0) AS already_returned
         FROM credit_note_details cnd
         INNER JOIN credit_notes cn ON cn.id = cnd.credit_note_id
         WHERE cnd.sale_detail_id = :sale_detail_id AND cn.status = 'applied'`,
        {
          replacements: {
            sale_detail_id: item.sale_detail_id,
            uph: effectiveUph
          },
          type: sequelize.QueryTypes.SELECT,
          transaction
        }
      );
      const alreadyReturned = parseFloat(returnedRows[0]?.already_returned || 0);
      const availableToReturn = unitsSold - alreadyReturned;

      // Validate that returned quantity doesn't exceed available quantity
      if (unitsReturned > availableToReturn) {
        await transaction.rollback();
        return res.status(400).json({
          message: `Solo quedan ${availableToReturn / effectiveUph} unidades disponibles para devolver de "${saleDetail.product.name}" (ya se devolvieron ${alreadyReturned / effectiveUph})`
        });
      }

      // Calculate line total using presentation units (unit_price is per presentation unit)
      const presentationUnitsReturned = item.package_quantity_returned + (item.loose_units_returned / effectiveUph);
      const line_subtotal = parseFloat(saleDetail.unit_price) * presentationUnitsReturned;
      const line_discount = line_subtotal * (parseFloat(saleDetail.discount_percent) / 100);
      const line_tax = (line_subtotal - line_discount) * (parseFloat(saleDetail.tax_percent) / 100);
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
      exchange_rate: parseFloat(sale.exchange_rate || 1),
      subtotal,
      tax_amount,
      total,
      refund_method: refund_method || 'none',
      refund_amount: refund_amount || (refund_method !== 'none' ? total : 0),
      refund_reference: refund_reference || null,
      notes: notes || null,
      created_by: (req as any).user.id
    }, { transaction }) as any;

    // Create credit note details
    for (const detail of creditNoteDetails) {
      await CreditNoteDetail.create({
        credit_note_id: creditNote.id,
        ...detail
      }, { transaction }) as any;
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
    }) as any;

    res.status(201).json({
      message: 'Nota de crédito creada exitosamente',
      data: createdCreditNote
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error creating credit note', { error: (error as Error).message });
    res.status(500).json({
      message: 'Error interno del servidor'
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
export const approveCreditNote = async (req: Request, res: Response) => {
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
            },
            {
              model: SaleDetail,
              as: 'saleDetail',
              attributes: ['id', 'is_unit']
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
    }) as any;

    if (!creditNote) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Nota de crédito no encontrada'
      });
    }

    // Validate status
    if (creditNote.status !== 'draft') {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Solo se pueden aprobar notas de crédito en estado borrador'
      });
    }

    // Process each returned product
    for (const detail of creditNote.details) {
      if (detail.return_to_stock) {
        // Calculate total units to return (respect is_unit)
        const uph = parseFloat(detail.presentation.units_per_package) || 1;
        const effectiveUph = detail.saleDetail?.is_unit ? 1 : uph;
        const totalUnits = (detail.package_quantity_returned * effectiveUph) + detail.loose_units_returned;

        // Find or create inventory record
        let inventory = await Inventory.findOne({
          where: {
            product_id: detail.product_id,
            warehouse_id: creditNote.warehouse_id
          },
          transaction
        }) as any;

        if (!inventory) {
          inventory = await Inventory.create({
            product_id: detail.product_id,
            warehouse_id: creditNote.warehouse_id,
            quantity: 0
          } as any, { transaction }) as any;
        }

        // Update inventory - ADD returned quantity
        await inventory.update({
          quantity: parseFloat(inventory.quantity) + totalUnits
        }, { transaction });

        // Create inventory movement record
        await InventoryMovement.create({
          product_id: detail.product_id,
          warehouse_id: creditNote.warehouse_id,
          presentation_id: detail.presentation_id,
          batch_id: detail.batch_id || null,
          movement_type: 'ingreso',
          package_quantity: detail.package_quantity_returned,
          loose_units: detail.loose_units_returned,
          quantity: totalUnits,
          unit_cost: detail.presentation.cost || null,
          package_cost: detail.presentation.package_cost || null,
          currency: detail.presentation.purchase_currency || 'USD',
          document_number: creditNote.credit_note_number,
          reason: `Devolución de venta ${creditNote.sale.sale_number}`,
          user_id: (req as any).user.id
        } as any, { transaction }) as any;

        // Update batch quantity if batch exists
        if (detail.batch_id) {
          const batch = await Batch.findByPk(detail.batch_id, { transaction }) as any;
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
      const customer = await Customer.findByPk(creditNote.customer_id, { transaction }) as any;
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
      approved_by: (req as any).user.id,
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
    }) as any;

    res.json({
      message: 'Nota de crédito aprobada y aplicada exitosamente',
      data: updatedCreditNote
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error approving credit note', { error: (error as Error).message });
    res.status(500).json({
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Cancel a credit note
 * POST /api/credit-notes/:id/cancel
 */
export const cancelCreditNote = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    // Find credit note
    const creditNote = await CreditNote.findByPk(id, { transaction }) as any;

    if (!creditNote) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Nota de crédito no encontrada'
      });
    }

    // Validate status
    if (creditNote.status === 'cancelled') {
      await transaction.rollback();
      return res.status(400).json({
        message: 'La nota de crédito ya está cancelada'
      });
    }

    if (creditNote.status === 'applied') {
      await transaction.rollback();
      return res.status(400).json({
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
      message: 'Nota de crédito cancelada exitosamente'
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Error cancelling credit note', { error: (error as Error).message });
    res.status(500).json({
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Get credit note statistics
 * GET /api/credit-notes/stats
 */
export const getCreditNoteStats = async (req: Request, res: Response) => {
  try {
    const { date_from, date_to } = req.query as Record<string, string>;
    const data = await _getCNStats({ date_from, date_to });
    res.json({ data });
  } catch (error) {
    logger.error('Error fetching credit note stats', { error: (error as Error).message });
    res.status(500).json({
      message: 'Error interno del servidor'
    });
  }
};