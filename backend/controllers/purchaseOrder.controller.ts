// Express type imports (ALWAYS at the top)
import { Request, Response, NextFunction } from 'express';

// Sequelize imports (only what is used in the controller)
import { Op } from 'sequelize';

// Model imports (esModuleInterop — require with export = in the .ts files)
import PurchaseOrder from '../models/PurchaseOrder';
import PurchaseOrderDetail from '../models/PurchaseOrderDetail';
import Supplier from '../models/Supplier';
import Warehouse from '../models/Warehouse';
import Product from '../models/Product';
import ProductPresentation from '../models/ProductPresentation';
import User from '../models/User';
import Inventory from '../models/Inventory';
import InventoryMovement from '../models/InventoryMovement';
import Batch from '../models/Batch';
import SupplierPayment from '../models/SupplierPayment';
import SupplierPaymentAllocation from '../models/SupplierPaymentAllocation';
import ExchangeRate from '../models/ExchangeRate';

// Other requires that are not models/sequelize/express → leave as require()
const logger = require('../config/logger');
const { sequelize } = require('../config/database');

class PurchaseOrderController {
  constructor() {
    this.generateOrderNumber = this.generateOrderNumber.bind(this);
    this.getAllPurchaseOrders = this.getAllPurchaseOrders.bind(this);
    this.getPurchaseOrderById = this.getPurchaseOrderById.bind(this);
    this.createPurchaseOrder = this.createPurchaseOrder.bind(this);
    this.updatePurchaseOrder = this.updatePurchaseOrder.bind(this);
    this.approvePurchaseOrder = this.approvePurchaseOrder.bind(this);
    this.cancelPurchaseOrder = this.cancelPurchaseOrder.bind(this);
    this.receiveMerchandise = this.receiveMerchandise.bind(this);
    this.getPurchaseOrderStats = this.getPurchaseOrderStats.bind(this);
  }

  // Generate unique order number (with transaction lock to prevent collisions)
  async generateOrderNumber(transaction: any) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const prefix = `OC-${year}${month}${day}`;

    // Find the last order of the day with exclusive lock
    const lastOrder = await PurchaseOrder.findOne({
      where: {
        order_number: {
          [Op.like]: `${prefix}%`
        }
      },
      order: [['order_number', 'DESC']],
      lock: transaction.LOCK.UPDATE,
      transaction
    }) as any;

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.order_number.split('-').pop());
      sequence = lastSequence + 1;
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }

  // Get all purchase orders with filters
  async getAllPurchaseOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page = '1',
        limit = '50',
        search,
        status,
        supplier_id,
        warehouse_id,
        date_from,
        date_to,
        sort_by = 'created_at',
        sort_dir = 'DESC'
      } = req.query as Record<string, string>;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const where: any = {};

      // Search filter
      if (search) {
        where[Op.or] = [
          { order_number: { [Op.like]: `%${search}%` } },
          { notes: { [Op.like]: `%${search}%` } },
          { '$supplier.name$': { [Op.like]: `%${search}%` } }
        ];
      }

      // Status filter
      if (status) {
        where.status = status;
      }

      // Supplier filter
      if (supplier_id) {
        where.supplier_id = supplier_id;
      }

      // Warehouse filter
      if (warehouse_id) {
        where.warehouse_id = warehouse_id;
      }

      // Date range filter
      if (date_from && date_to) {
        where.order_date = {
          [Op.between]: [date_from, date_to]
        };
      } else if (date_from) {
        where.order_date = {
          [Op.gte]: date_from
        };
      } else if (date_to) {
        where.order_date = {
          [Op.lte]: date_to
        };
      }

      const { rows: orders, count } = await PurchaseOrder.findAndCountAll({
        where,
        include: [
          {
            model: Supplier,
            as: 'supplier',
            attributes: ['id', 'name', 'tax_id', 'payment_terms']
          },
          {
            model: Warehouse,
            as: 'warehouse',
            attributes: ['id', 'code', 'name']
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'username', 'first_name', 'last_name']
          },
          {
            model: User,
            as: 'approver',
            attributes: ['id', 'username', 'first_name', 'last_name']
          }
        ],
        limit: parseInt(limit),
        offset,
        order: [[sort_by, sort_dir.toUpperCase()] as [string, string]]
      }) as any;

      // Batch: last invoice number + payment allocations (evita N+1)
      const orderNumbers = orders.map(o => o.order_number);
      const orderIds = orders.map(o => o.id);

      const [allMovements, allAllocs] = await Promise.all([
        InventoryMovement.findAll({
          where: {
            reason: { [Op.or]: orderNumbers.map(n => ({ [Op.like]: `OC ${n}%` })) },
            document_number: { [Op.notIn]: orderNumbers }
          },
          order: [['created_at', 'DESC']],
          attributes: ['document_number', 'reason']
        }),
        SupplierPaymentAllocation.findAll({
          where: { purchase_order_id: { [Op.in]: orderIds } },
          include: [{ model: SupplierPayment, as: 'payment', where: { status: { [Op.ne]: 'cancelled' } }, required: true, attributes: [] }],
          attributes: ['purchase_order_id', 'allocated_amount_po_currency']
        })
      ]) as [any[], any[]];

      // Agrupar movimientos por order_number (ya vienen DESC, el primero = más reciente)
      const lastInvoiceByOrder: any = {};
      for (const mov of allMovements) {
        const match = String(mov.reason).match(/^OC (\S+)/);
        if (match && !lastInvoiceByOrder[match[1]]) {
          lastInvoiceByOrder[match[1]] = mov.document_number;
        }
      }

      // Agrupar allocations por purchase_order_id
      const allocsByOrder: any = {};
      for (const alloc of allAllocs) {
        const oid = alloc.purchase_order_id;
        if (!allocsByOrder[oid]) allocsByOrder[oid] = [];
        allocsByOrder[oid].push(alloc);
      }

      const ordersWithInvoice = orders.map(order => {
        const orderJson = order.toJSON();
        orderJson.last_invoice_number = lastInvoiceByOrder[order.order_number] || '';

        const allocs = allocsByOrder[order.id] || [];
        const totalPaid = allocs.reduce((sum, a) => sum + parseFloat(a.allocated_amount_po_currency || 0), 0);
        orderJson.payment_status = totalPaid >= parseFloat(order.total) - 0.01 ? 'paid' : (totalPaid > 0 ? 'partial' : 'pending');

        return orderJson;
      });

      res.json({
        data: ordersWithInvoice,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get purchase order by ID
  async getPurchaseOrderById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const order = await PurchaseOrder.findByPk(id, {
        include: [
          {
            model: Supplier,
            as: 'supplier',
            attributes: ['id', 'name', 'tax_id', 'payment_terms']
          },
          {
            model: Warehouse,
            as: 'warehouse',
            attributes: ['id', 'code', 'name', 'address']
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'username', 'first_name', 'last_name']
          },
          {
            model: User,
            as: 'updater',
            attributes: ['id', 'username', 'first_name', 'last_name']
          },
          {
            model: User,
            as: 'approver',
            attributes: ['id', 'username', 'first_name', 'last_name']
          },
          {
            model: PurchaseOrderDetail,
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
            ]
          }
        ]
      }) as any;

      if (!order) {
        return res.status(404).json({
          message: 'Orden de compra no encontrada'
        });
      }

      // Fetch all inventory movements related to this PO for history and invoices
      const movements = await InventoryMovement.findAll({
        where: {
          reason: { [Op.like]: `OC ${order.order_number}%` }
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'first_name', 'last_name']
          }
        ],
        order: [['created_at', 'DESC']]
      }) as any[];

      const orderJson = order.toJSON();

      // Extract unique invoice numbers (excluding the PO number itself)
      const uniqueInvoices = [...new Set(movements
        .map(m => m.document_number)
        .filter(doc => doc && doc !== order.order_number)
      )];

      orderJson.invoices = uniqueInvoices;
      orderJson.last_invoice_number = uniqueInvoices[0] || '';

      // Group movements by document + date for a cleaner history (avoid per-product duplicates)
      const groupedHistory: any = {};
      for (const m of movements) {
        const dateKey = m.created_at ? new Date(m.created_at).toISOString().slice(0, 16) : 'unknown';
        const key = `${m.document_number || 'N/A'}_${dateKey}`;
        if (!groupedHistory[key]) {
          groupedHistory[key] = {
            id: m.id,
            date: m.created_at,
            document_number: m.document_number,
            quantity: 0,
            user: m.user ? `${m.user.first_name} ${m.user.last_name}` : 'Sistema',
            notes: m.reason,
            product_count: 0
          };
        }
        groupedHistory[key].quantity += parseInt(m.quantity || 0);
        groupedHistory[key].product_count += 1;
      }

      orderJson.reception_history = Object.values(groupedHistory);

      // Calculate payment status and history for single order
      const allocs = await SupplierPaymentAllocation.findAll({
        where: { purchase_order_id: order.id },
        include: [{
          model: SupplierPayment,
          as: 'payment',
          where: { status: { [Op.ne]: 'cancelled' } },
          attributes: ['id', 'payment_number', 'payment_date', 'payment_method', 'amount', 'currency']
        }]
      }) as any[];

      const totalPaid = allocs.reduce((sum, a) => sum + parseFloat(a.allocated_amount_po_currency || 0), 0);
      orderJson.payment_status = totalPaid >= parseFloat(order.total) - 0.01 ? 'paid' : (totalPaid > 0 ? 'partial' : 'pending');

      orderJson.payment_history = allocs.map(a => ({
        id: a.payment.id,
        payment_number: a.payment.payment_number,
        payment_date: a.payment.payment_date,
        payment_method: a.payment.payment_method,
        total_payment_amount: a.payment.amount,
        payment_currency: a.payment.currency,
        allocated_amount: a.allocated_amount,
        allocated_amount_po_currency: a.allocated_amount_po_currency,
        exchange_rate_used: a.exchange_rate_used
      })).sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

      res.json({
        data: orderJson
      });
    } catch (error) {
      next(error);
    }
  }

  // Create purchase order
  async createPurchaseOrder(req: Request, res: Response, next: NextFunction) {
    const transaction = await sequelize.transaction();

    try {
      const {
        supplier_id,
        warehouse_id,
        order_date,
        expected_delivery_date,
        currency,
        settlement_currency,
        notes,
        items
      } = req.body;

      // Validate required fields
      if (!supplier_id || !warehouse_id || !items || items.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: 'Proveedor, almacén y productos son requeridos'
        });
      }

      // Generate order number
      const order_number = await this.generateOrderNumber(transaction);

      // Calculate totals
      let subtotal = 0;
      let tax_amount = 0;
      let discount_amount = 0;

      items.forEach(item => {
        const packageTotal = (item.package_quantity || 0) * (item.package_cost || 0);
        const unitsTotal = (item.loose_units || 0) * (item.unit_cost || 0);
        const itemSubtotal = packageTotal + unitsTotal;
        const itemDiscount = itemSubtotal * ((item.discount_percent || 0) / 100);
        const taxableAmount = itemSubtotal - itemDiscount;
        const itemTax = taxableAmount * ((item.tax_percent || 0) / 100);

        subtotal += itemSubtotal;
        discount_amount += itemDiscount;
        tax_amount += itemTax;
      });

      const total = subtotal - discount_amount + tax_amount;

      // Determine settlement currency default based on invoice currency
      const effectiveCurrency = currency || 'USD';
      const effectiveSettlement = settlement_currency || (effectiveCurrency === 'COP' ? 'COP' : 'VES');

      // Create purchase order
      const purchaseOrder = await PurchaseOrder.create(
        {
          order_number,
          supplier_id,
          warehouse_id,
          order_date: order_date || new Date(),
          expected_delivery_date,
          currency: effectiveCurrency,
          settlement_currency: effectiveSettlement,
          subtotal,
          tax_amount,
          discount_amount,
          total,
          notes,
          status: 'draft',
          created_by: (req as any).user.id
        },
        { transaction }
      ) as any;

      // Create order details
      for (const item of items) {
        const packageTotal = (item.package_quantity || 0) * (item.package_cost || 0);
        const unitsTotal = (item.loose_units || 0) * (item.unit_cost || 0);
        const itemSubtotal = packageTotal + unitsTotal;
        const itemDiscount = itemSubtotal * ((item.discount_percent || 0) / 100);
        const taxableAmount = itemSubtotal - itemDiscount;
        const itemTax = taxableAmount * ((item.tax_percent || 0) / 100);
        const line_total = itemSubtotal - itemDiscount + itemTax;

        await PurchaseOrderDetail.create(
          {
            purchase_order_id: purchaseOrder.id,
            product_id: item.product_id,
            presentation_id: item.presentation_id,
            package_quantity: item.package_quantity || 0,
            loose_units: item.loose_units || 0,
            unit_cost: item.unit_cost || 0,
            package_cost: item.package_cost || 0,
            discount_percent: item.discount_percent || 0,
            tax_percent: item.tax_percent || 0,
            line_total
          },
          { transaction }
        ) as any;
      }

      await transaction.commit();

      // Fetch complete order with associations
      const completeOrder = await PurchaseOrder.findByPk(purchaseOrder.id, {
        include: [
          { model: Supplier, as: 'supplier' },
          { model: Warehouse, as: 'warehouse' },
          { model: User, as: 'creator' },
          {
            model: PurchaseOrderDetail,
            as: 'details',
            include: [
              { model: Product, as: 'product' },
              { model: ProductPresentation, as: 'presentation' }
            ]
          }
        ]
      }) as any;

      res.status(201).json({
        message: 'Orden de compra creada exitosamente',
        data: completeOrder
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  // Update purchase order (only if status is 'draft')
  async updatePurchaseOrder(req: Request, res: Response, next: NextFunction) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const {
        supplier_id,
        warehouse_id,
        order_date,
        expected_delivery_date,
        currency,
        settlement_currency,
        notes,
        items
      } = req.body;

      const order = await PurchaseOrder.findByPk(id) as any;

      if (!order) {
        await transaction.rollback();
        return res.status(404).json({
          message: 'Orden de compra no encontrada'
        });
      }

      if (order.status !== 'draft') {
        await transaction.rollback();
        return res.status(400).json({
          message: 'Solo se pueden editar órdenes en estado borrador'
        });
      }

      // Recalculate totals
      let subtotal = 0;
      let tax_amount = 0;
      let discount_amount = 0;

      if (items && items.length > 0) {
        items.forEach(item => {
          const packageTotal = (item.package_quantity || 0) * (item.package_cost || 0);
          const unitsTotal = (item.loose_units || 0) * (item.unit_cost || 0);
          const itemSubtotal = packageTotal + unitsTotal;
          const itemDiscount = itemSubtotal * ((item.discount_percent || 0) / 100);
          const taxableAmount = itemSubtotal - itemDiscount;
          const itemTax = taxableAmount * ((item.tax_percent || 0) / 100);

          subtotal += itemSubtotal;
          discount_amount += itemDiscount;
          tax_amount += itemTax;
        });
      }

      const total = subtotal - discount_amount + tax_amount;

      // Update order
      await order.update(
        {
          supplier_id: supplier_id || order.supplier_id,
          warehouse_id: warehouse_id || order.warehouse_id,
          order_date: order_date || order.order_date,
          expected_delivery_date: expected_delivery_date || order.expected_delivery_date,
          currency: currency || order.currency,
          settlement_currency: settlement_currency || order.settlement_currency,
          notes,
          subtotal,
          tax_amount,
          discount_amount,
          total,
          updated_by: (req as any).user.id
        },
        { transaction }
      );

      // Update details if provided
      if (items && items.length > 0) {
        // Delete existing details
        await PurchaseOrderDetail.destroy({
          where: { purchase_order_id: id },
          transaction
        });

        // Create new details
        for (const item of items) {
          const packageTotal = (item.package_quantity || 0) * (item.package_cost || 0);
          const unitsTotal = (item.loose_units || 0) * (item.unit_cost || 0);
          const itemSubtotal = packageTotal + unitsTotal;
          const itemDiscount = itemSubtotal * ((item.discount_percent || 0) / 100);
          const taxableAmount = itemSubtotal - itemDiscount;
          const itemTax = taxableAmount * ((item.tax_percent || 0) / 100);
          const line_total = itemSubtotal - itemDiscount + itemTax;

          await PurchaseOrderDetail.create(
            {
              purchase_order_id: order.id,
              product_id: item.product_id,
              presentation_id: item.presentation_id,
              package_quantity: item.package_quantity || 0,
              loose_units: item.loose_units || 0,
              unit_cost: item.unit_cost || 0,
              package_cost: item.package_cost || 0,
              discount_percent: item.discount_percent || 0,
              tax_percent: item.tax_percent || 0,
              line_total
            },
            { transaction }
          ) as any;
        }
      }

      await transaction.commit();

      // Fetch updated order
      const updatedOrder = await PurchaseOrder.findByPk(id, {
        include: [
          { model: Supplier, as: 'supplier' },
          { model: Warehouse, as: 'warehouse' },
          {
            model: PurchaseOrderDetail,
            as: 'details',
            include: [
              { model: Product, as: 'product' },
              { model: ProductPresentation, as: 'presentation' }
            ]
          }
        ]
      }) as any;

      res.json({
        message: 'Orden de compra actualizada exitosamente',
        data: updatedOrder
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  // Approve purchase order
  async approvePurchaseOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const order = await PurchaseOrder.findByPk(id) as any;

      if (!order) {
        return res.status(404).json({
          message: 'Orden de compra no encontrada'
        });
      }

      if (order.status !== 'draft') {
        return res.status(400).json({
          message: 'Solo se pueden aprobar órdenes en estado borrador'
        });
      }

      await order.update({
        status: 'sent',
        approved_by: (req as any).user.id,
        approved_at: new Date()
      });

      res.json({
        message: 'Orden de compra aprobada exitosamente',
        data: order
      });
    } catch (error) {
      next(error);
    }
  }

  // Cancel purchase order
  async cancelPurchaseOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { cancellation_reason } = req.body;

      const order = await PurchaseOrder.findByPk(id) as any;

      if (!order) {
        return res.status(404).json({
          message: 'Orden de compra no encontrada'
        });
      }

      if (order.status === 'received') {
        return res.status(400).json({
          message: 'No se puede cancelar una orden completamente recibida'
        });
      }

      await order.update({
        status: 'cancelled',
        notes: order.notes
          ? `${order.notes}\n\nCANCELADA: ${cancellation_reason || 'Sin motivo especificado'}`
          : `CANCELADA: ${cancellation_reason || 'Sin motivo especificado'}`,
        updated_by: (req as any).user.id
      });

      res.json({
        message: 'Orden de compra cancelada exitosamente',
        data: order
      });
    } catch (error) {
      next(error);
    }
  }

  // Receive merchandise (full or partial)
  async receiveMerchandise(req: Request, res: Response, next: NextFunction) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const { received_items, invoice_number, notes } = req.body;

      if (!received_items || received_items.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: 'Debe especificar los productos recibidos'
        });
      }

      const order = await PurchaseOrder.findByPk(id, {
        include: [
          {
            model: PurchaseOrderDetail,
            as: 'details',
            include: [
              { model: Product, as: 'product' },
              { model: ProductPresentation, as: 'presentation' }
            ]
          }
        ]
      }) as any;

      if (!order) {
        await transaction.rollback();
        return res.status(404).json({
          message: 'Orden de compra no encontrada'
        });
      }

      if (!['sent', 'confirmed', 'partially_received'].includes(order.status)) {
        await transaction.rollback();
        return res.status(400).json({
          message: 'El estado de la orden no permite recibir mercancía'
        });
      }

      // Process each received item
      for (const receivedItem of received_items) {
        const detail = order.details.find(d => d.id === receivedItem.detail_id);

        if (!detail) {
          await transaction.rollback();
          return res.status(400).json({
            message: `Detalle con ID ${receivedItem.detail_id} no encontrado en la orden`
          });
        }

        const packageQtyToReceive = receivedItem.package_quantity || 0;
        const looseUnitsToReceive = receivedItem.loose_units || 0;

        // Validate quantities
        const totalOrderedPackages = detail.package_quantity;
        const totalReceivedPackages = detail.received_package_quantity + packageQtyToReceive;
        const totalOrderedUnits = detail.loose_units;
        const totalReceivedUnits = detail.received_loose_units + looseUnitsToReceive;

        if (totalReceivedPackages > totalOrderedPackages || totalReceivedUnits > totalOrderedUnits) {
          await transaction.rollback();
          return res.status(400).json({
            message: `No se puede recibir más cantidad de la ordenada para ${detail.product.name}`
          });
        }

        // Update received quantities in detail
        await detail.update(
          {
            received_package_quantity: totalReceivedPackages,
            received_loose_units: totalReceivedUnits
          },
          { transaction }
        );

        // Calculate total units
        const unitsPerPackage = detail.presentation.units_per_package || 1;
        const totalUnits = (packageQtyToReceive * unitsPerPackage) + looseUnitsToReceive;

        if (totalUnits > 0) {
          // Update or create inventory record
          const [inventory] = await Inventory.findOrCreate({
            where: {
              product_id: detail.product_id,
              warehouse_id: order.warehouse_id
            },
            defaults: {
              quantity: 0
            },
            transaction
          }) as any;

          await inventory.increment('quantity', {
            by: totalUnits,
            transaction
          });

          // Create inventory movement
          await InventoryMovement.create(
            {
              product_id: detail.product_id,
              warehouse_id: order.warehouse_id,
              presentation_id: detail.presentation_id,
              batch_id: receivedItem.batch_id || null,
              movement_type: 'ingreso',
              package_quantity: packageQtyToReceive,
              loose_units: looseUnitsToReceive,
              quantity: totalUnits,
              unit_cost: detail.unit_cost,
              package_cost: detail.package_cost,
              currency: order.currency || 'USD',
              document_number: invoice_number || order.order_number,
              reason: `OC ${order.order_number}${notes ? ': ' + notes : ''}`,
              user_id: (req as any).user.id
            },
            { transaction }
          ) as any;

          // Handle batch if provided
          if (receivedItem.batch_number) {
            await Batch.create(
              {
                product_id: detail.product_id,
                warehouse_id: order.warehouse_id,
                batch_number: receivedItem.batch_number,
                quantity: totalUnits,
                manufacturing_date: receivedItem.manufacture_date || null,
                expiration_date: receivedItem.expiry_date || null,
                cost: detail.unit_cost
              },
              { transaction }
            ) as any;
          }

          // CRITICAL: Update product presentation costs
          // This updates the base purchase price in the system
          const presentation = await ProductPresentation.findByPk(detail.presentation_id, {
            transaction
          }) as any;

          if (presentation) {
            // Check if we need to convert currencies
            let newPackageCost = detail.package_cost;
            let newUnitCost = detail.unit_cost;

            if (order.currency && presentation.purchase_currency && order.currency !== presentation.purchase_currency) {
              try {
                // Determine transaction date for accurate historical rate, defaulting to right now
                const rateDate = new Date();

                // Convert costs from the PO currency to the Presentation's base currency
                newPackageCost = await (ExchangeRate as any).convert(
                  detail.package_cost,
                  order.currency,
                  presentation.purchase_currency,
                  rateDate
                );

                newUnitCost = await (ExchangeRate as any).convert(
                  detail.unit_cost,
                  order.currency,
                  presentation.purchase_currency,
                  rateDate
                );
              } catch (conversionError) {
                logger.error(`Failed to convert cost for product ${detail.product_id} from ${order.currency} to ${presentation.purchase_currency}:`, conversionError);
                // In case of failure, we will temporarily preserve the raw value to avoid transaction crash,
                // but the system will log this. Ideally an alert should be triggered.
              }
            }

            await presentation.update(
              {
                package_cost: newPackageCost,
                cost: newUnitCost
              },
              { transaction }
            );
          }
        }
      }

      // Check if order is fully received
      const updatedOrder = await PurchaseOrder.findByPk(id, {
        include: [{ model: PurchaseOrderDetail, as: 'details' }],
        transaction
      }) as any;

      const allReceived = updatedOrder.details.every(detail => {
        return (
          detail.received_package_quantity >= detail.package_quantity &&
          detail.received_loose_units >= detail.loose_units
        );
      });

      const anyReceived = updatedOrder.details.some(detail => {
        return detail.received_package_quantity > 0 || detail.received_loose_units > 0;
      });

      let newStatus = order.status;
      if (allReceived) {
        newStatus = 'received';
      } else if (anyReceived) {
        newStatus = 'partially_received';
      }

      await updatedOrder.update(
        {
          status: newStatus,
          delivery_date: allReceived ? new Date() : order.delivery_date,
          updated_by: (req as any).user.id
        },
        { transaction }
      );

      await transaction.commit();

      // Fetch complete updated order
      const finalOrder = await PurchaseOrder.findByPk(id, {
        include: [
          { model: Supplier, as: 'supplier' },
          { model: Warehouse, as: 'warehouse' },
          {
            model: PurchaseOrderDetail,
            as: 'details',
            include: [
              { model: Product, as: 'product' },
              { model: ProductPresentation, as: 'presentation' }
            ]
          }
        ]
      }) as any;

      res.json({
        message: 'Mercancía recibida exitosamente',
        data: finalOrder
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  // Get purchase order statistics
  async getPurchaseOrderStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { date_from, date_to, supplier_id } = req.query;
      const where: any = {};

      if (supplier_id) {
        where.supplier_id = supplier_id;
      }

      if (date_from && date_to) {
        where.order_date = {
          [Op.between]: [date_from, date_to]
        };
      }

      const totalOrders = await PurchaseOrder.count({ where });

      const ordersByStatus = await PurchaseOrder.findAll({
        where,
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('total')), 'total_amount']
        ],
        group: ['status']
      }) as any[];

      const valueByCurrency = await PurchaseOrder.findAll({
        where,
        attributes: [
          'currency',
          [sequelize.fn('SUM', sequelize.col('total')), 'total']
        ],
        group: ['currency']
      }) as any[];

      const pendingOrders = await PurchaseOrder.count({
        where: {
          ...where,
          status: {
            [Op.in]: ['draft', 'sent', 'confirmed', 'partially_received']
          }
        }
      });

      res.json({
        data: {
          total_orders: totalOrders,
          pending_orders: pendingOrders,
          value_by_currency: valueByCurrency,
          by_status: ordersByStatus
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export = new PurchaseOrderController();