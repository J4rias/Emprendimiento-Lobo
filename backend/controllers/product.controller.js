const { Product, Category, ProductPresentation, Barcode, Inventory, Warehouse, Brand, PackagingType, PresentationType } = require('../models');
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
      const include = [
        { model: Category, as: 'category' },
        { model: Brand, as: 'brand' },
        {
          model: ProductPresentation,
          as: 'presentations',
          include: [
            { model: PackagingType, as: 'packagingType' },
            { model: PresentationType, as: 'presentationType' }
          ]
        },
        { model: Barcode, as: 'barcodes' }
      ];

      if (search) {
        // Search in product name, SKU, or barcode
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { sku: { [Op.like]: `%${search}%` } },
          { '$barcodes.barcode$': { [Op.like]: `%${search}%` } }
        ];
      }

      if (category_id) where.category_id = category_id;
      if (is_active !== undefined) where.is_active = is_active;
      if (is_perishable !== undefined) where.is_perishable = is_perishable;

      const { rows: products, count } = await Product.findAndCountAll({
        where,
        include,
        distinct: true,
        subQuery: false,
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
          { model: Brand, as: 'brand' },
          {
            model: ProductPresentation,
            as: 'presentations',
            include: [
              { model: PackagingType, as: 'packagingType' },
              { model: PresentationType, as: 'presentationType' }
            ]
          },
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
        barcode,
        brand_id,
        is_perishable,
        has_batch_control,
        min_stock,
        max_stock,
        reorder_point,
        image_url,
        // Presentation fields
        packaging_type_id,
        presentation_type_id,
        units_per_package,
        unit_size,
        unit_size_measure,
        package_price,
        package_cost,
        purchase_currency
      } = req.body;

      // Get image URL from processed files if uploaded, or use provided image_url
      const finalImageUrl = req.processedFiles && req.processedFiles.length > 0
        ? req.processedFiles[0].url
        : (image_url || null);

      // Optional: validate barcode uniqueness BEFORE creating product
      const normalizedBarcode = barcode && String(barcode).trim() ? String(barcode).trim() : null;
      if (normalizedBarcode) {
        const existingBarcode = await Barcode.findOne({
          where: { barcode: normalizedBarcode, is_active: true }
        });

        if (existingBarcode) {
          return res.status(400).json({
            success: false,
            message: 'El código de barras ya está asignado a otro producto'
          });
        }
      }

      // Get brand for SKU generation
      let brandName = null;
      if (brand_id) {
        const brand = await Brand.findByPk(brand_id);
        brandName = brand?.name || null;
      }

      // Generate SKU - will be updated after presentations are created
      // For now, create a temporary SKU
      const tempSku = `TEMP-${Date.now()}`;

      // Create product
      const product = await Product.create({
        sku: tempSku,
        name,
        description,
        category_id,
        brand_id,
        is_perishable,
        has_batch_control,
        min_stock,
        max_stock,
        reorder_point,
        image_url: finalImageUrl,
        created_by: req.userId
      });

      // Create default presentation if presentation data provided
      if (packaging_type_id || presentation_type_id || units_per_package) {
        const presentationName = `${name} - Presentación estándar`;
        const unitsPerPkg = parseInt(units_per_package) || 1;
        
        await ProductPresentation.create({
          product_id: product.id,
          packaging_type_id: packaging_type_id || null,
          presentation_type_id: presentation_type_id || null,
          name: presentationName,
          units_per_package: unitsPerPkg,
          unit_size: unit_size || null,
          unit_size_measure: unit_size_measure || null,
          units_per_presentation: unitsPerPkg, // For compatibility
          package_price: package_price || 0,
          package_cost: package_cost || 0,
          base_price: package_price ? (parseFloat(package_price) / unitsPerPkg) : 0,
          cost: package_cost ? (parseFloat(package_cost) / unitsPerPkg) : 0,
          purchase_currency: purchase_currency || 'USD',
          is_default: true,
          is_active: true
        });
      }

      // Optional: create barcode record for scanner-based workflows
      if (normalizedBarcode) {
        await Barcode.create({
          product_id: product.id,
          presentation_id: null,
          barcode: normalizedBarcode,
          type: 'EAN13',
          is_primary: true,
          is_active: true
        });
      }

      // Reload with associations
      await product.reload({
        include: [
          { model: Category, as: 'category' },
          { model: Brand, as: 'brand' },
          {
            model: ProductPresentation,
            as: 'presentations',
            include: [
              { model: PackagingType, as: 'packagingType' },
              { model: PresentationType, as: 'presentationType' }
            ]
          },
          { model: Barcode, as: 'barcodes' }
        ]
      });

      // Generate final SKU based on product data and presentations
      const finalSku = skuConfig.generate({
        brandName,
        productName: name,
        presentations: product.presentations,
        brand_id: brand_id,
        existingSku: null
      });

      // Update product with final SKU
      await product.update({ sku: finalSku });
      product.sku = finalSku;

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
      const barcode = updateData.barcode;
      delete updateData.barcode;
      delete updateData.created_by;

      // Extract presentation fields
      const {
        packaging_type_id,
        presentation_type_id,
        units_per_package,
        unit_size,
        unit_size_measure,
        package_price,
        package_cost,
        purchase_currency
      } = updateData;
      
      // Remove presentation fields from product update
      delete updateData.packaging_type_id;
      delete updateData.presentation_type_id;
      delete updateData.units_per_package;
      delete updateData.unit_size;
      delete updateData.unit_size_measure;
      delete updateData.package_price;
      delete updateData.package_cost;
      delete updateData.purchase_currency;

      // Get image URL from processed files if uploaded, or use provided image_url
      if (req.processedFiles && req.processedFiles.length > 0) {
        updateData.image_url = req.processedFiles[0].url;
      }

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

      // Update or create default presentation if presentation data provided
      if (packaging_type_id !== undefined || presentation_type_id !== undefined || units_per_package !== undefined) {
        const defaultPresentation = await ProductPresentation.findOne({
          where: { product_id: product.id, is_default: true }
        });

        const unitsPerPkg = parseInt(units_per_package) || 1;
        const presentationData = {
          packaging_type_id: packaging_type_id || null,
          presentation_type_id: presentation_type_id || null,
          units_per_package: unitsPerPkg,
          unit_size: unit_size || null,
          unit_size_measure: unit_size_measure || null,
          units_per_presentation: unitsPerPkg,
          package_price: package_price || 0,
          package_cost: package_cost || 0,
          base_price: package_price ? (parseFloat(package_price) / unitsPerPkg) : 0,
          cost: package_cost ? (parseFloat(package_cost) / unitsPerPkg) : 0,
          purchase_currency: purchase_currency || 'USD'
        };

        if (defaultPresentation) {
          await defaultPresentation.update(presentationData);
        } else {
          await ProductPresentation.create({
            product_id: product.id,
            name: `${product.name} - Presentación estándar`,
            ...presentationData,
            is_default: true,
            is_active: true
          });
        }
      }

      // Reload with associations
      await product.reload({
        include: [
          { model: Category, as: 'category' },
          { model: Brand, as: 'brand' },
          {
            model: ProductPresentation,
            as: 'presentations',
            include: [
              { model: PackagingType, as: 'packagingType' },
              { model: PresentationType, as: 'presentationType' }
            ]
          },
          { model: Barcode, as: 'barcodes' }
        ]
      });

      // Optional: upsert barcode record
      if (barcode !== undefined) {
        const normalizedBarcode = String(barcode || '').trim();

        if (!normalizedBarcode) {
          // If barcode is cleared, deactivate existing primary barcodes
          await Barcode.update(
            { is_active: false, is_primary: false },
            { where: { product_id: product.id } }
          );
        } else {
          const existingBarcode = await Barcode.findOne({
            where: { barcode: normalizedBarcode, is_active: true }
          });

          if (existingBarcode && existingBarcode.product_id !== product.id) {
            return res.status(400).json({
              success: false,
              message: 'El código de barras ya está asignado a otro producto'
            });
          }

          // Deactivate other barcodes for this product
          await Barcode.update(
            { is_primary: false },
            { where: { product_id: product.id } }
          );

          // Upsert barcode for this product
          const productBarcode = await Barcode.findOne({
            where: { product_id: product.id, barcode: normalizedBarcode }
          });

          if (productBarcode) {
            await productBarcode.update({ is_active: true, is_primary: true });
          } else {
            await Barcode.create({
              product_id: product.id,
              presentation_id: null,
              barcode: normalizedBarcode,
              type: 'EAN13',
              is_primary: true,
              is_active: true
            });
          }

          await product.reload({
            include: [
              { model: Category, as: 'category' },
              { model: Brand, as: 'brand' },
              {
                model: ProductPresentation,
                as: 'presentations',
                include: [
                  { model: PackagingType, as: 'packagingType' },
                  { model: PresentationType, as: 'presentationType' }
                ]
              },
              { model: Barcode, as: 'barcodes' }
            ]
          });
        }
      }

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

      if (barcodeRecord?.product) {
        return res.json({
          success: true,
          data: barcodeRecord.product
        });
      }

      // Fallback: allow searching by SKU (useful when barcode is stored as sku)
      const productBySku = await Product.findOne({
        where: { sku: barcode, is_active: true },
        include: [
          { model: Category, as: 'category' },
          { model: ProductPresentation, as: 'presentations' },
          { model: Barcode, as: 'barcodes' }
        ]
      });

      if (!productBySku) {
        return res.status(200).json({
          success: true,
          data: null,
          message: 'Barcode not found'
        });
      }

      return res.json({
        success: true,
        data: productBySku
      });
    } catch (error) {
      next(error);
    }
  }

  // Presentation Management Methods

  async getPresentations(req, res, next) {
    try {
      const { id } = req.params;

      const product = await Product.findByPk(id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const presentations = await ProductPresentation.findAll({
        where: { product_id: id },
        include: [
          { model: PackagingType, as: 'packagingType' },
          { model: PresentationType, as: 'presentationType' }
        ],
        order: [['is_default', 'DESC'], ['id', 'ASC']]
      });

      return res.json({
        success: true,
        data: presentations
      });
    } catch (error) {
      next(error);
    }
  }

  async createPresentation(req, res, next) {
    try {
      const { id } = req.params;
      const {
        name,
        packaging_type_id,
        presentation_type_id,
        units_per_package,
        unit_size,
        unit_size_measure,
        package_price,
        package_cost,
        purchase_currency,
        is_default,
        is_active
      } = req.body;

      const product = await Product.findByPk(id);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // If this is set as default, unmark all other presentations as default
      if (is_default) {
        await ProductPresentation.update(
          { is_default: false },
          { where: { product_id: id } }
        );
      }

      const presentation = await ProductPresentation.create({
        product_id: id,
        name,
        packaging_type_id: packaging_type_id || null,
        presentation_type_id: presentation_type_id || null,
        units_per_package: units_per_package || 1,
        unit_size: unit_size || null,
        unit_size_measure: unit_size_measure || 'UND',
        units_per_presentation: units_per_package || 1, // For compatibility
        package_price: package_price || 0,
        package_cost: package_cost || 0,
        purchase_currency: purchase_currency || 'USD',
        is_default: is_default || false,
        is_active: is_active !== undefined ? is_active : true
      });

      // Reload with associations
      const createdPresentation = await ProductPresentation.findByPk(presentation.id, {
        include: [
          { model: PackagingType, as: 'packagingType' },
          { model: PresentationType, as: 'presentationType' }
        ]
      });

      return res.status(201).json({
        success: true,
        data: createdPresentation,
        message: 'Presentation created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePresentation(req, res, next) {
    try {
      const { presentationId } = req.params;
      const updateData = req.body;

      const presentation = await ProductPresentation.findByPk(presentationId);
      if (!presentation) {
        return res.status(404).json({
          success: false,
          message: 'Presentation not found'
        });
      }

      // Update units_per_presentation if units_per_package is updated
      if (updateData.units_per_package !== undefined) {
        updateData.units_per_presentation = updateData.units_per_package;
      }

      await presentation.update(updateData);

      // Reload with associations
      const updatedPresentation = await ProductPresentation.findByPk(presentationId, {
        include: [
          { model: PackagingType, as: 'packagingType' },
          { model: PresentationType, as: 'presentationType' }
        ]
      });

      return res.json({
        success: true,
        data: updatedPresentation,
        message: 'Presentation updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async deletePresentation(req, res, next) {
    try {
      const { presentationId } = req.params;

      const presentation = await ProductPresentation.findByPk(presentationId);
      if (!presentation) {
        return res.status(404).json({
          success: false,
          message: 'Presentation not found'
        });
      }

      // Check if this is the last presentation for the product
      const presentationCount = await ProductPresentation.count({
        where: { product_id: presentation.product_id }
      });

      if (presentationCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last presentation. A product must have at least one presentation.'
        });
      }

      // If this is the default presentation, set another one as default
      if (presentation.is_default) {
        const anotherPresentation = await ProductPresentation.findOne({
          where: {
            product_id: presentation.product_id,
            id: { [Op.ne]: presentationId }
          }
        });

        if (anotherPresentation) {
          await anotherPresentation.update({ is_default: true });
        }
      }

      await presentation.destroy();

      return res.json({
        success: true,
        message: 'Presentation deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async setDefaultPresentation(req, res, next) {
    try {
      const { presentationId } = req.params;

      const presentation = await ProductPresentation.findByPk(presentationId);
      if (!presentation) {
        return res.status(404).json({
          success: false,
          message: 'Presentation not found'
        });
      }

      // Unmark all presentations for this product as default
      await ProductPresentation.update(
        { is_default: false },
        { where: { product_id: presentation.product_id } }
      );

      // Mark this one as default
      await presentation.update({ is_default: true });

      // Reload with associations
      const updatedPresentation = await ProductPresentation.findByPk(presentationId, {
        include: [
          { model: PackagingType, as: 'packagingType' },
          { model: PresentationType, as: 'presentationType' }
        ]
      });

      return res.json({
        success: true,
        data: updatedPresentation,
        message: 'Default presentation updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductController();
