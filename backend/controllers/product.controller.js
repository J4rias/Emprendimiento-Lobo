const { Product, Category, ProductPresentation, Barcode, Inventory, Warehouse } = require('../models');
const { Op } = require('sequelize');
const skuConfig = require('../config/sku');

class ProductController {
  // Get all products with pagination and filters
  async getAll(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        category_id,
        is_active,
        is_perishable
      } = req.query;

      const offset = (page - 1) * limit;
      const where = {};

      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { sku: { [Op.like]: `%${search}%` } },
          { brand: { [Op.like]: `%${search}%` } }
        ];
      }

      if (category_id) where.category_id = category_id;
      if (is_active !== undefined) where.is_active = is_active;
      if (is_perishable !== undefined) where.is_perishable = is_perishable;

      const { rows: products, count } = await Product.findAndCountAll({
        where,
        include: [
          { model: Category, as: 'category' },
          { model: ProductPresentation, as: 'presentations' },
          { model: Barcode, as: 'barcodes' }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['created_at', 'DESC']]
      });

      res.json({
        success: true,
        data: products,
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

  // Get product by ID
  async getById(req, res, next) {
    try {
      const { id } = req.params;

      const product = await Product.findByPk(id, {
        include: [
          { model: Category, as: 'category' },
          { model: ProductPresentation, as: 'presentations' },
          { model: Barcode, as: 'barcodes' },
          {
            model: Inventory,
            as: 'inventories',
            include: [{ model: Warehouse, as: 'warehouse' }]
          }
        ]
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  // Create product
  async create(req, res, next) {
    try {
      const {
        name,
        description,
        category_id,
        brand,
        manufacturer,
        unit_of_measure,
        tax_rate,
        is_perishable,
        has_batch_control,
        min_stock,
        max_stock,
        reorder_point
      } = req.body;

      // Get category to generate SKU
      const category = await Category.findByPk(category_id);
      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Category not found'
        });
      }

      // Get next sequence for SKU
      const lastProduct = await Product.findOne({
        where: { category_id },
        order: [['id', 'DESC']]
      });

      const sequence = lastProduct ? lastProduct.id + 1 : skuConfig.startFrom;
      const sku = skuConfig.generate(category.code, sequence);

      // Create product
      const product = await Product.create({
        sku,
        name,
        description,
        category_id,
        brand,
        manufacturer,
        unit_of_measure,
        tax_rate,
        is_perishable,
        has_batch_control,
        min_stock,
        max_stock,
        reorder_point,
        created_by: req.userId
      });

      // Reload with associations
      await product.reload({
        include: [
          { model: Category, as: 'category' }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  // Update product
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };
      delete updateData.sku; // SKU cannot be updated
      delete updateData.created_by;

      const product = await Product.findByPk(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Update product
      await product.update({
        ...updateData,
        updated_by: req.userId
      });

      // Reload with associations
      await product.reload({
        include: [
          { model: Category, as: 'category' },
          { model: ProductPresentation, as: 'presentations' },
          { model: Barcode, as: 'barcodes' }
        ]
      });

      res.json({
        success: true,
        message: 'Product updated successfully',
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete product (soft delete)
  async delete(req, res, next) {
    try {
      const { id } = req.params;

      const product = await Product.findByPk(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Check if product has inventory
      const inventory = await Inventory.findOne({
        where: { product_id: id, quantity: { [Op.gt]: 0 } }
      });

      if (inventory) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete product with existing inventory'
        });
      }

      // Soft delete
      await product.update({ is_active: false });

      res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Search by barcode
  async searchByBarcode(req, res, next) {
    try {
      const { barcode } = req.params;

      const barcodeRecord = await Barcode.findOne({
        where: { barcode, is_active: true },
        include: [{
          model: Product,
          as: 'product',
          include: [
            { model: Category, as: 'category' },
            { model: ProductPresentation, as: 'presentations' }
          ]
        }]
      });

      if (!barcodeRecord) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        data: barcodeRecord.product
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductController();
