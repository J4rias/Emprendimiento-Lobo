const { Inventory, Product, Warehouse, Batch, Category, ProductPresentation } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

class InventoryController {
  // Get inventory by warehouse
  async getByWarehouse(req, res, next) {
    try {
      const { warehouse_id } = req.params;
      const {
        page = 1,
        limit = 50,
        search,
        category_id,
        low_stock,
        expiring,
        out_of_stock
      } = req.query;

      const offset = (page - 1) * limit;
      const where = warehouse_id === 'all' ? {} : { warehouse_id };
      const productWhere = {};

      if (search) {
        productWhere[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { sku: { [Op.like]: `%${search}%` } }
        ];
      }

      if (category_id) {
        productWhere.category_id = category_id;
      }

      const { rows: inventory, count } = await Inventory.findAndCountAll({
        where,
        include: [{
          model: Product,
          as: 'product',
          where: productWhere,
          include: [
            { model: Category, as: 'category' }
          ]
        }],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [[{ model: Product, as: 'product' }, 'name', 'ASC']]
      });

      // Filter items in JavaScript if needed
      let filteredInventory = inventory;
      if (low_stock === 'true') {
        filteredInventory = inventory.filter(item => 
          parseFloat(item.quantity) <= parseFloat(item.product.reorder_point)
        );
      }
      
      if (expiring === 'true') {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        filteredInventory = inventory.filter(item => {
          // Check if any batch is expiring within 30 days
          return item.product && item.product.batches && item.product.batches.some(batch => {
            if (!batch.expiration_date) return false;
            const expirationDate = new Date(batch.expiration_date);
            return expirationDate <= thirtyDaysFromNow && expirationDate >= new Date();
          });
        });
      }
      
      if (out_of_stock === 'true') {
        filteredInventory = inventory.filter(item => 
          parseFloat(item.quantity) <= 0
        );
      }

      res.json({
        success: true,
        data: filteredInventory,
        pagination: {
          total: (low_stock === 'true' || expiring === 'true' || out_of_stock === 'true') ? filteredInventory.length : count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get inventory by ID
  async getById(req, res, next) {
    try {
      const { id } = req.params;

      const inventory = await Inventory.findOne({
        where: { id },
        include: [
          {
            model: Warehouse,
            as: 'warehouse'
          },
          {
            model: Product,
            as: 'product',
            include: [
              { model: Category, as: 'category' },
              { model: ProductPresentation, as: 'presentations' }
            ]
          }
        ]
      });

      if (!inventory) {
        return res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        });
      }

      res.json({
        success: true,
        data: inventory
      });
    } catch (error) {
      next(error);
    }
  }

  // Get inventory for specific product
  async getByProduct(req, res, next) {
    try {
      const { product_id } = req.params;

      const inventory = await Inventory.findAll({
        where: { product_id },
        include: [
          {
            model: Warehouse,
            as: 'warehouse'
          },
          {
            model: Product,
            as: 'product',
            include: [{ model: Category, as: 'category' }]
          }
        ],
        order: [['quantity', 'DESC']]
      });

      const totalQuantity = inventory.reduce((sum, inv) => sum + parseFloat(inv.quantity), 0);

      res.json({
        success: true,
        data: {
          inventory,
          totalQuantity
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get low stock products
  async getLowStock(req, res, next) {
    try {
      const { warehouse_id } = req.query;
      const where = {};

      if (warehouse_id) {
        where.warehouse_id = warehouse_id;
      }

      const inventory = await Inventory.findAll({
        where,
        include: [{
          model: Product,
          as: 'product',
          include: [{ model: Category, as: 'category' }]
        }, {
          model: Warehouse,
          as: 'warehouse'
        }],
        order: [[{ model: Product, as: 'product' }, 'name', 'ASC']]
      });

      // Filter low stock items in JavaScript
      const lowStockItems = inventory.filter(item => 
        parseFloat(item.quantity) <= parseFloat(item.product.reorder_point)
      );

      res.json({
        success: true,
        data: lowStockItems,
        count: lowStockItems.length
      });
    } catch (error) {
      next(error);
    }
  }

  // Adjust inventory
  async adjustInventory(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const {
        product_id,
        warehouse_id,
        quantity,
        type, // 'add' or 'remove'
        reason,
        batch_id
      } = req.body;

      // Validate
      if (!['add', 'remove'].includes(type)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Invalid adjustment type. Must be "add" or "remove"'
        });
      }

      // Find or create inventory record
      let [inventory] = await Inventory.findOrCreate({
        where: { product_id, warehouse_id },
        defaults: {
          product_id,
          warehouse_id,
          quantity: 0,
          reserved_quantity: 0
        },
        transaction
      });

      // Calculate new quantity
      const adjustment = type === 'add' ? parseFloat(quantity) : -parseFloat(quantity);
      const newQuantity = parseFloat(inventory.quantity) + adjustment;

      if (newQuantity < 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Insufficient inventory'
        });
      }

      // Update inventory
      await inventory.update({
        quantity: newQuantity,
        last_movement_date: new Date()
      }, { transaction });

      // If batch control, update batch
      if (batch_id) {
        const batch = await Batch.findByPk(batch_id, { transaction });
        if (batch) {
          await batch.update({
            quantity: parseFloat(batch.quantity) + adjustment
          }, { transaction });
        }
      }

      // Here you would also create an inventory movement record
      // for audit trail (to be implemented in movements table)

      await transaction.commit();

      // Reload inventory with associations
      await inventory.reload({
        include: [
          { model: Product, as: 'product' },
          { model: Warehouse, as: 'warehouse' }
        ]
      });

      res.json({
        success: true,
        message: 'Inventory adjusted successfully',
        data: inventory
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  // Get products about to expire
  async getExpiringProducts(req, res, next) {
    try {
      const { days = 30, warehouse_id } = req.query;
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + parseInt(days));

      const where = {
        expiration_date: {
          [Op.lte]: expirationDate,
          [Op.gte]: new Date()
        },
        quantity: { [Op.gt]: 0 }
      };

      if (warehouse_id) {
        where.warehouse_id = warehouse_id;
      }

      const batches = await Batch.findAll({
        where,
        include: [
          {
            model: Product,
            as: 'product',
            include: [{ model: Category, as: 'category' }]
          },
          {
            model: Warehouse,
            as: 'warehouse'
          }
        ],
        order: [['expiration_date', 'ASC']]
      });

      res.json({
        success: true,
        data: batches,
        count: batches.length
      });
    } catch (error) {
      next(error);
    }
  }

  // Get inventory valuation
  async getValuation(req, res, next) {
    try {
      const { warehouse_id } = req.query;
      const where = {};

      if (warehouse_id) {
        where.warehouse_id = warehouse_id;
      }

      const inventory = await Inventory.findAll({
        where,
        include: [{
          model: Product,
          as: 'product',
          include: [{
            model: ProductPresentation,
            as: 'presentations',
            where: { is_default: true },
            required: false
          }]
        }]
      });

      const totalsByCurrency = {
        USD: 0,
        COP: 0,
        VES: 0
      };

      const valuedItems = inventory.map(inv => {
        const defaultPresentation = inv.product?.presentations?.[0];
        const cost = defaultPresentation?.cost || 0;
        const currency = defaultPresentation?.purchase_currency || 'USD';
        const quantity = parseFloat(inv.quantity) || 0;
        const value = quantity * parseFloat(cost || 0);

        // Sum by currency
        if (totalsByCurrency.hasOwnProperty(currency)) {
          totalsByCurrency[currency] += value;
        }

        return {
          product: inv.product,
          quantity: inv.quantity,
          cost,
          currency,
          value
        };
      });

      // Total value is only USD for now (can be extended to convert all to USD)
      const totalValue = totalsByCurrency.USD;

      res.json({
        success: true,
        data: {
          items: valuedItems,
          totalValue,
          totalsByCurrency,
          currency: 'USD'
        }
      });
    } catch (error) {
      console.error('Error in getValuation:', error);
      // Return default values on error
      res.json({
        success: true,
        data: {
          items: [],
          totalValue: 0,
          totalsByCurrency: { USD: 0, COP: 0, VES: 0 },
          currency: 'USD'
        }
      });
    }
  }
}

module.exports = new InventoryController();
