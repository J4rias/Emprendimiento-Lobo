const {
  PurchaseOrder,
  PurchaseOrderDetail,
  Supplier,
  Warehouse,
  Product,
  ProductPresentation,
  User,
  Inventory,
  InventoryMovement,
  Batch
} = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

class PurchaseOrderController {
  // Generate unique order number
  async generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const prefix = `OC-${year}${month}${day}`;

    // Find the last order of the day
    const lastOrder = await PurchaseOrder.findOne({
      where: {
        order_number: {
          [Op.like]: `${prefix}%`
        }
      },
      order: [['order_number', 'DESC']]
    });

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.order_number.split('-').pop());
      sequence = lastSequence + 1;
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }

  // Get all purchase orders with filters
  async getAllPurchaseOrders(req, res, next) {
    try {
      const {
        page = 1,
        limit = 50,
        search,
        status,
        supplier_id,
        warehouse_id,
        date_from,
        date_to,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = req.query;

      const offset = (page - 1) * limit;
      const where = {};

      // Search filter
      if (search) {
        where[Op.or] = [
          { order_number: { [Op.like]: `%${search}%` } },
          { notes: { [Op.like]: `%${search}%` } }
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
        offset: parseInt(offset),
        order: [[sortBy, sortOrder.toUpperCase()]]
      });

      res.json({
        success: true,
        data: orders,
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
  }

  // Get purchase order by ID
  async getPurchaseOrderById(req, res, next) {
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
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Orden de compra no encontrada'
        });
      }

      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      next(error);
    }
  }

  // Create purchase order
  async createPurchaseOrder(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const {
        supplier_id,
        warehouse_id,
        order_date,
        expected_delivery_date,
        currency,
        notes,
        items
      } = req.body;

      // Validate required fields
      if (!supplier_id || !warehouse_id || !items || items.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Proveedor, almacén y productos son requeridos'
        });
      }

      // Generate order number
      const order_number = await this.generateOrderNumber();

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

      // Create purchase order
      const purchaseOrder = await PurchaseOrder.create(
        {
          order_number,
          supplier_id,
          warehouse_id,
          order_date: order_date || new Date(),
          expected_delivery_date,
          currency: currency || 'USD',
          subtotal,
          tax_amount,
          discount_amount,
          total,
          notes,
          status: 'draft',
          created_by: req.user.id
        },
        { transaction }
      );

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
        );
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
      });

      res.status(201).json({
        success: true,
        message: 'Orden de compra creada exitosamente',
        data: completeOrder
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  // Update purchase order (only if status is 'draft')
  async updatePurchaseOrder(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const {
        supplier_id,
        warehouse_id,
        order_date,
        expected_delivery_date,
        currency,
        notes,
        items
      } = req.body;

      const order = await PurchaseOrder.findByPk(id);

      if (!order) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Orden de compra no encontrada'
        });
      }

      if (order.status !== 'draft') {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
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
          notes,
          subtotal,
          tax_amount,
          discount_amount,
          total,
          updated_by: req.user.id
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
          );
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
      });

      res.json({
        success: true,
        message: 'Orden de compra actualizada exitosamente',
        data: updatedOrder
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  // Approve purchase order
  async approvePurchaseOrder(req, res, next) {
    try {
      const { id } = req.params;

      const order = await PurchaseOrder.findByPk(id);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Orden de compra no encontrada'
        });
      }

      if (order.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: 'Solo se pueden aprobar órdenes en estado borrador'
        });
      }

      await order.update({
        status: 'sent',
        approved_by: req.user.id,
        approved_at: new Date()
      });

      res.json({
        success: true,
        message: 'Orden de compra aprobada exitosamente',
        data: order
      });
    } catch (error) {
      next(error);
    }
  }

  // Cancel purchase order
  async cancelPurchaseOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { cancellation_reason } = req.body;

      const order = await PurchaseOrder.findByPk(id);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Orden de compra no encontrada'
        });
      }

      if (order.status === 'received') {
        return res.status(400).json({
          success: false,
          message: 'No se puede cancelar una orden completamente recibida'
        });
      }

      await order.update({
        status: 'cancelled',
        notes: order.notes
          ? `${order.notes}\n\nCANCELADA: ${cancellation_reason || 'Sin motivo especificado'}`
          : `CANCELADA: ${cancellation_reason || 'Sin motivo especificado'}`,
        updated_by: req.user.id
      });

      res.json({
        success: true,
        message: 'Orden de compra cancelada exitosamente',
        data: order
      });
    } catch (error) {
      next(error);
    }
  }

  // Receive merchandise (full or partial)
  async receiveMerchandise(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const { received_items, invoice_number, notes } = req.body;

      if (!received_items || received_items.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
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
      });

      if (!order) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Orden de compra no encontrada'
        });
      }

      if (!['sent', 'confirmed', 'partially_received'].includes(order.status)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'El estado de la orden no permite recibir mercancía'
        });
      }

      // Process each received item
      for (const receivedItem of received_items) {
        const detail = order.details.find(d => d.id === receivedItem.detail_id);

        if (!detail) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
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
            success: false,
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
              quantity: 0,
              min_stock: 0,
              max_stock: 0
            },
            transaction
          });

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
              type: 'ingreso',
              subtype: 'compra',
              package_quantity: packageQtyToReceive,
              loose_units: looseUnitsToReceive,
              total_units: totalUnits,
              unit_cost: detail.unit_cost,
              document_type: 'purchase_order',
              document_number: order.order_number,
              reference_document: invoice_number || null,
              notes: notes || `Recepción de OC ${order.order_number}`,
              user_id: req.user.id
            },
            { transaction }
          );

          // Handle batch if provided
          if (receivedItem.batch_number) {
            await Batch.create(
              {
                product_id: detail.product_id,
                warehouse_id: order.warehouse_id,
                batch_number: receivedItem.batch_number,
                quantity: totalUnits,
                manufacture_date: receivedItem.manufacture_date || null,
                expiry_date: receivedItem.expiry_date || null,
                cost: detail.unit_cost
              },
              { transaction }
            );
          }

          // CRITICAL: Update product presentation costs
          // This updates the base purchase price in the system
          const presentation = await ProductPresentation.findByPk(detail.presentation_id, {
            transaction
          });

          if (presentation) {
            // Update package_cost and unit cost based on the purchase order
            const newPackageCost = detail.package_cost;
            const newUnitCost = detail.unit_cost;

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
      });

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
          updated_by: req.user.id
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
      });

      res.json({
        success: true,
        message: 'Mercancía recibida exitosamente',
        data: finalOrder
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  // Get purchase order statistics
  async getPurchaseOrderStats(req, res, next) {
    try {
      const { date_from, date_to, supplier_id } = req.query;
      const where = {};

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
      });

      const totalValue = await PurchaseOrder.sum('total', { where });

      const pendingOrders = await PurchaseOrder.count({
        where: {
          ...where,
          status: {
            [Op.in]: ['draft', 'sent', 'confirmed', 'partially_received']
          }
        }
      });

      res.json({
        success: true,
        data: {
          total_orders: totalOrders,
          pending_orders: pendingOrders,
          total_value: totalValue || 0,
          by_status: ordersByStatus
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PurchaseOrderController();
