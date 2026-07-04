// Express type imports (ALWAYS at the top)
import { Request, Response, NextFunction } from 'express';

// Sequelize imports (only what is used in the controller)
import { Op } from 'sequelize';

// Model imports (esModuleInterop — require with export = in the .ts files)
import Inventory from '../models/Inventory';
import Product from '../models/Product';
import Warehouse from '../models/Warehouse';
import Batch from '../models/Batch';
import Category from '../models/Category';
import ProductPresentation from '../models/ProductPresentation';
import ExchangeRate from '../models/ExchangeRate';
import InventoryMovement from '../models/InventoryMovement';
import User from '../models/User';
import Barcode from '../models/Barcode';

// Other requires that are not models/sequelize/express → leave as require()
const logger = require('../config/logger');
const { sequelize } = require('../config/database');

class InventoryController {
  // Get inventory by warehouse
  async getByWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
      const { warehouse_id } = req.params;
      const {
        page = '1',
        limit = '50',
        search,
        category_id,
        low_stock,
        expiring,
        out_of_stock
      } = req.query as Record<string, string>;

      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const where: any = warehouse_id === 'all' ? {} : { warehouse_id };

      // Search and category filters are best handled by finding matching products first
      // This avoids complex join issues with findAndCountAll and ensures barcode search works
      if (search || category_id) {
        const productSearchWhere: any = {};
        if (search) {
          productSearchWhere[Op.or] = [
            { name: { [Op.like]: `%${search}%` } },
            { sku: { [Op.like]: `%${search}%` } },
            sequelize.where(sequelize.col('barcodes.barcode'), { [Op.like]: `%${search}%` })
          ];
        }
        if (category_id) {
          productSearchWhere.category_id = category_id;
        }

        // Only active products
        productSearchWhere.is_active = true;

        const matchingProducts = await Product.findAll({
          where: productSearchWhere,
          include: [{ model: Barcode, as: 'barcodes', attributes: [] }],
          attributes: ['id'],
          raw: true
        }) as any[];

        const matchingProductIds = matchingProducts.map(p => p.id);
        where.product_id = { [Op.in]: matchingProductIds.length > 0 ? matchingProductIds : [0] };
      }

      // Status filters — applied in SQL BEFORE pagination
      const statusFilters: any[] = [];

      if (out_of_stock === 'true') {
        statusFilters.push(sequelize.literal('`Inventory`.`quantity` <= 0'));
      }

      if (low_stock === 'true') {
        statusFilters.push(sequelize.literal('`Inventory`.`quantity` <= `product`.`reorder_point`'));
      }

      if (expiring === 'true') {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        const batchWhere: any = {
          expiration_date: { [Op.lte]: thirtyDaysFromNow, [Op.gte]: new Date() },
          quantity: { [Op.gt]: 0 }
        };
        if (warehouse_id !== 'all') {
          batchWhere.warehouse_id = warehouse_id;
        }

        const expiringBatches = await Batch.findAll({
          where: batchWhere,
          attributes: ['product_id'],
          group: ['product_id'],
          raw: true
        }) as any[];

        const expiringProductIds = expiringBatches.map(b => parseInt(b.product_id));
        if (expiringProductIds.length > 0) {
          statusFilters.push(sequelize.literal(`\`Inventory\`.\`product_id\` IN (${expiringProductIds.join(',')})`));
        } else {
          statusFilters.push(sequelize.literal('1 = 0'));
        }
      }

      if (statusFilters.length === 1) {
        if (!where[Op.and]) where[Op.and] = [];
        where[Op.and].push(statusFilters[0]);
      } else if (statusFilters.length > 1) {
        if (!where[Op.and]) where[Op.and] = [];
        where[Op.and].push({ [Op.or]: statusFilters });
      }

      const { rows: inventory, count } = await Inventory.findAndCountAll({
        distinct: true,
        subQuery: false,
        where,
        include: [
          {
            model: Product,
            as: 'product',
            where: { is_active: true },
            include: [
              { model: Category, as: 'category' },
              { model: Barcode, as: 'barcodes', attributes: ['barcode'] }
            ]
          },
          {
            model: Warehouse,
            as: 'warehouse'
          }
        ],
        limit: parseInt(limit),
        offset,
        order: [[{ model: Product, as: 'product' }, 'name', 'ASC']]
      }) as any;

      // Load presentations separately for each product
      const productIds = [...new Set(inventory.map(item => item.product_id))];
      const presentations = await ProductPresentation.findAll({
        where: { product_id: productIds } as any,
        attributes: ['id', 'product_id', 'name', 'units_per_package', 'package_price', 'package_cost', 'purchase_currency', 'is_default', 'is_active']
      }) as any[];

      // Group presentations by product_id
      const presentationsByProduct: any = {};
      presentations.forEach(pres => {
        if (!presentationsByProduct[pres.product_id]) {
          presentationsByProduct[pres.product_id] = [];
        }
        presentationsByProduct[pres.product_id].push(pres);
      });

      // Convert to plain JSON and attach presentations
      const inventoryWithPresentations = inventory.map(item => {
        const plainItem = item.toJSON();
        if (plainItem.product) {
          plainItem.product.presentations = presentationsByProduct[item.product_id] || [];
        }
        return plainItem;
      });

      res.json({
        data: inventoryWithPresentations,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      });
    } catch (error) {
      logger.error('Error in getByWarehouse', { error: error.message });
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  // GET /api/inventory?warehouse_id=X or ?product_id=X (new normalized endpoint)
  async getByQuery(req: Request, res: Response, next: NextFunction) {
    const { warehouse_id, product_id } = req.query as Record<string, string>;
    if (product_id) {
      req.params.product_id = product_id;
      return this.getByProduct(req, res, next);
    }
    // warehouse_id (or 'all') — default to 'all' when neither is provided
    req.params.warehouse_id = warehouse_id || 'all';
    return this.getByWarehouse(req, res, next);
  }

  // Get inventory by ID
  async getById(req: Request, res: Response, next: NextFunction) {
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
            where: { is_active: true },
            include: [
              { model: Category, as: 'category' },
              { model: ProductPresentation, as: 'presentations' }
            ]
          }
        ]
      }) as any;

      if (!inventory) {
        return res.status(404).json({
          message: 'Artículo de inventario no encontrado'
        });
      }

      res.json({
        data: inventory
      });
    } catch (error) {
      logger.error('Error in getById', { error: error.message });
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  // Get inventory for specific product
  async getByProduct(req: Request, res: Response, next: NextFunction) {
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
            where: { is_active: true },
            include: [
              { model: Category, as: 'category' },
              { model: ProductPresentation, as: 'presentations' }
            ]
          }
        ],
        order: [['quantity', 'DESC']]
      }) as any[];

      const totalQuantity = inventory.reduce((sum, inv) => sum + parseFloat(inv.quantity), 0);

      res.json({
        data: {
          inventory,
          totalQuantity
        }
      });
    } catch (error) {
      logger.error('Error in getByProduct', { error: error.message });
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  // Get low stock products
  async getLowStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { warehouse_id } = req.query;
      const where: any = {};

      if (warehouse_id) {
        where.warehouse_id = warehouse_id;
      }

      const inventory = await Inventory.findAll({
        where,
        include: [{
          model: Product,
          as: 'product',
          where: { is_active: true },
          include: [{ model: Category, as: 'category' }]
        }, {
          model: Warehouse,
          as: 'warehouse'
        }],
        order: [[{ model: Product, as: 'product' }, 'name', 'ASC']]
      }) as any[];

      // Filter low stock items in JavaScript
      const lowStockItems = inventory.filter(item =>
        parseFloat(item.quantity) <= parseFloat(item.product.reorder_point)
      );

      res.json({
        data: lowStockItems,
        count: lowStockItems.length
      });
    } catch (error) {
      logger.error('Error in getLowStock', { error: error.message });
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  // Adjust inventory
  async adjustInventory(req: Request, res: Response, next: NextFunction) {
    const transaction = await sequelize.transaction();

    try {
      const {
        product_id,
        warehouse_id,
        presentation_id,
        package_quantity,
        loose_units = '0',
        type, // 'add' or 'remove'
        reason,
        batch_id,
        document_number
      } = req.body;

      const user_id = (req as any).user.id;

      // Validate
      if (!product_id || !warehouse_id || !type) {
        await transaction.rollback();
        return res.status(400).json({
          message: 'Faltan campos requeridos'
        });
      }

      if (!['add', 'remove'].includes(type)) {
        await transaction.rollback();
        return res.status(400).json({
          message: 'Invalid adjustment type. Must be "add" or "remove"'
        });
      }

      // Buscar presentación si se especificó
      let presentation = null;
      let units_per_package = 1;

      if (presentation_id) {
        presentation = await ProductPresentation.findByPk(presentation_id, { transaction }) as any;
        if (!presentation) {
          await transaction.rollback();
          return res.status(404).json({
            message: 'Presentación no encontrada'
          });
        }
        units_per_package = presentation.units_per_package;
      }

      // Calcular cantidad total en unidades base
      const packageUnits = (parseInt(package_quantity, 10) || 0) * units_per_package;
      const totalUnits = packageUnits + parseFloat(loose_units);

      if (totalUnits <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: 'La cantidad debe ser mayor a 0'
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
      }) as any;

      // Calculate new quantity
      const adjustment = type === 'add' ? totalUnits : -totalUnits;
      const newQuantity = parseFloat(inventory.quantity) + adjustment;

      if (newQuantity < 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: 'No hay suficiente stock para realizar esta operación'
        });
      }

      // Update inventory
      await inventory.update({
        quantity: newQuantity,
        last_movement_date: new Date()
      }, { transaction });

      // If batch control, update batch
      if (batch_id) {
        const batch = await Batch.findByPk(batch_id, { transaction }) as any;
        if (batch) {
          await batch.update({
            quantity: parseFloat(batch.quantity) + adjustment
          }, { transaction });
        }
      }

      // Registrar movimiento en historial
      const movement = await InventoryMovement.create({
        product_id,
        warehouse_id,
        presentation_id: presentation_id || null,
        movement_type: type === 'add' ? 'ajuste_positivo' : 'ajuste_negativo',
        package_quantity: parseInt(package_quantity, 10) || null,
        loose_units: parseFloat(loose_units),
        quantity: totalUnits,
        unit_cost: presentation?.cost || null,
        package_cost: presentation?.package_cost || null,
        currency: presentation?.purchase_currency || 'USD',
        reason,
        document_number,
        batch_id,
        user_id
      }, { transaction }) as any;

      await transaction.commit();

      // Reload inventory with associations
      await inventory.reload({
        include: [
          { model: Product, as: 'product', include: [{ model: ProductPresentation, as: 'presentations' }] },
          { model: Warehouse, as: 'warehouse' }
        ]
      });

      res.json({
        message: 'Inventario ajustado correctamente',
        data: {
          inventory,
          movement
        }
      });
    } catch (error) {
      await transaction.rollback();
      logger.error('Error in adjustInventory', { error: error.message });
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  // Get products about to expire
  async getExpiringProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { days = '30', warehouse_id } = req.query as Record<string, string>;
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + parseInt(days));

      const where: any = {
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
            where: { is_active: true },
            include: [{ model: Category, as: 'category' }]
          },
          {
            model: Warehouse,
            as: 'warehouse'
          }
        ],
        order: [['expiration_date', 'ASC']]
      }) as any[];

      res.json({
        data: batches,
        count: batches.length
      });
    } catch (error) {
      logger.error('Error in getExpiringProducts', { error: error.message });
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  // Get inventory valuation
  async getValuation(req: Request, res: Response, next: NextFunction) {
    try {
      const { warehouse_id } = req.query;
      const where: any = {};

      if (warehouse_id) {
        where.warehouse_id = warehouse_id;
      }

      const inventory = await Inventory.findAll({
        where,
        include: [{
          model: Product,
          as: 'product',
          where: { is_active: true },
          include: [{
            model: ProductPresentation,
            as: 'presentations'
          }]
        }]
      }) as any[];

      const totalsByCurrency: any = {
        USD: 0,
        COP: 0,
        VES: 0
      };

      const valuedItems = inventory.map(inv => {
        // Get default presentation or first available
        const defaultPresentation = inv.product?.presentations?.find(p => p.is_default) || inv.product?.presentations?.[0];

        // Use unit cost, or calculate from package cost as fallback
        let cost = parseFloat(defaultPresentation?.cost || 0);
        const unitsPerPkg = parseInt(defaultPresentation?.units_per_package) || 1;
        const packageCost = parseFloat(defaultPresentation?.package_cost || 0);

        if (cost === 0 && packageCost > 0) {
          cost = packageCost / unitsPerPkg;
        }

        const currency = defaultPresentation?.purchase_currency || 'USD';
        const quantity = parseFloat(inv.quantity) || 0;
        const value = quantity * cost;

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

      // Convert all currencies to USD
      let totalValueUSD = totalsByCurrency.USD;
      const conversions: any[] = [];
      const warnings: any[] = [];

      // Process each non-USD currency
      for (const [currency, amount] of Object.entries(totalsByCurrency)) {
        if (currency === 'USD' || amount === 0) continue;

        try {
          // Convert amount to USD
          const converted = await (ExchangeRate as any).convert(amount, currency, 'USD');
          const rate = await (ExchangeRate as any).getRate(currency, 'USD');

          totalValueUSD += converted;
          conversions.push({
            currency,
            originalAmount: amount,
            rate: rate || 0,
            convertedAmount: converted
          });
        } catch (error) {
          logger.warn(`No exchange rate found for ${currency} to USD:`, error.message);
          warnings.push({
            currency,
            amount,
            message: `No se encontró tasa de cambio de ${currency} a USD. Este monto no está incluido en el total.`
          });
        }
      }

      // Convert all currencies to COP
      let totalValueCOP = totalsByCurrency.COP;
      for (const [currency, amount] of Object.entries(totalsByCurrency)) {
        if (currency === 'COP' || amount === 0) continue;
        try {
          totalValueCOP += await (ExchangeRate as any).convert(amount, currency, 'COP');
        } catch (e) { /* already warned above */ }
      }

      const productsWithStock = new Set(inventory.filter(inv => parseFloat(inv.quantity) > 0).map(inv => inv.product_id)).size;

      res.json({
        data: {
          items: valuedItems,
          totalValue: totalValueUSD,  // Total converted to USD
          totalValueCOP,  // Total converted to COP
          totalsByCurrency,  // Original breakdown by currency
          conversions,  // Conversion details
          warnings,  // Warnings for missing rates
          currency: 'USD',
          productsWithStock
        }
      });
    } catch (error) {
      logger.error('Error in getValuation', { error: error.message });
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  // Obtener historial de movimientos
  async getMovements(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        product_id,
        warehouse_id,
        movement_type,
        date_from,
        date_to,
        page = '1',
        limit = '50'
      } = req.query as Record<string, string>;

      const where: any = {};

      if (product_id) where.product_id = product_id;
      if (warehouse_id) where.warehouse_id = warehouse_id;
      if (movement_type) where.movement_type = movement_type;

      if (date_from || date_to) {
        where.created_at = {};
        if (date_from) where.created_at[Op.gte] = date_from;
        if (date_to) where.created_at[Op.lte] = date_to;
      }

      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

      const { count, rows: movements } = await InventoryMovement.findAndCountAll({
        where,
        include: [
          { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
          { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'] },
          { model: ProductPresentation, as: 'presentation', attributes: ['id', 'name', 'units_per_package'] },
          { model: User, as: 'user', attributes: ['id', 'username', 'first_name', 'last_name'] }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset
      }) as any;

      res.json({
        data: movements,
        pagination: {
          total: count,
          page: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      });

    } catch (error) {
      logger.error('Error in getMovements', { error: error.message });
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  // Get all warehouses
  async getWarehouses(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouses = await Warehouse.findAll({
        order: [['name', 'ASC']],
        attributes: ['id', 'code', 'name', 'description', 'address', 'city', 'is_active']
      }) as any[];

      res.json({
        data: warehouses
      });

    } catch (error) {
      logger.error('Error in getWarehouses', { error: error.message });
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
}

export = new InventoryController();