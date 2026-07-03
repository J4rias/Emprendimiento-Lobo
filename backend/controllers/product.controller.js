const {
  Product, Category, ProductPresentation, Barcode,
  Inventory, Warehouse, Brand, PackagingType,
  PresentationType, PriceListDetail
} = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const skuConfig = require('../config/sku');

class ProductController {
  // Get all products with pagination and filters
  async getAll(req, res, next) {
    try {
      const {
        page = 1,
        limit = 25,
        search,
        category_id,
        is_active,
        is_perishable,
        price_list_id
      } = req.query;

      const offset = (page - 1) * limit;
      const where = {};
      let posAttributes; // undefined = all fields (non-POS)

      const presentationInclude = {
        model: ProductPresentation,
        as: 'presentations',
        include: [
          { model: PackagingType, as: 'packagingType' },
          { model: PresentationType, as: 'presentationType' }
        ]
      };

      const include = [
        { model: Category, as: 'category' },
        { model: Brand, as: 'brand' },
        presentationInclude,
        {
          model: Barcode,
          as: 'barcodes',
          where: { is_active: true },
          required: false
        },
        {
          model: Inventory,
          as: 'inventories',
          include: [{ model: Warehouse, as: 'warehouse' }]
        }
      ];

      if (price_list_id && price_list_id !== 'null' && price_list_id !== 'undefined') {
        // Only show products in the price list AND with price > 0
        include.push({
          model: PriceListDetail,
          as: 'priceListDetails',
          where: {
            price_list_id,
            package_price: { [Op.gt]: 0 }
          },
          required: true,
          attributes: []
        });

        // Also filter and mandate the presentations to be in the price list
        presentationInclude.required = true;
        presentationInclude.include.push({
          model: PriceListDetail,
          as: 'priceListDetails',
          where: {
            price_list_id,
            package_price: { [Op.gt]: 0 }
          },
          required: true,
          attributes: []
        });

        // In POS (when price_list_id is present), also filter by total stock > 0
        const inventoryInclude = include.find(inc => inc.as === 'inventories');
        if (inventoryInclude) {
          inventoryInclude.required = true;
          inventoryInclude.where = {
            quantity: { [Op.gt]: 0 }
          };
        }

        // POS mode: slim down payload (~70% smaller — remove unused fields/associations)
        const catIdx = include.findIndex(i => i.as === 'category');
        if (catIdx > -1) include.splice(catIdx, 1);
        const brandIdx = include.findIndex(i => i.as === 'brand');
        if (brandIdx > -1) include.splice(brandIdx, 1);

        presentationInclude.attributes = ['id', 'name', 'units_per_package', 'package_price', 'purchase_currency'];
        presentationInclude.include = presentationInclude.include.filter(i => i.as === 'priceListDetails');

        if (inventoryInclude) {
          inventoryInclude.attributes = ['quantity', 'warehouse_id'];
          delete inventoryInclude.include;
        }

        const barcodeInclude = include.find(i => i.as === 'barcodes');
        if (barcodeInclude) barcodeInclude.attributes = ['barcode'];

        posAttributes = ['id', 'name', 'sku', 'is_active'];
      }

      if (search) {
        // Search in product name, SKU, or barcode
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { sku: { [Op.like]: `%${search}%` } },
          sequelize.where(sequelize.col('barcodes.barcode'), { [Op.like]: `%${search}%` })
        ];
      }

      if (category_id) where.category_id = category_id;

      // Default to only active products unless specified
      if (is_active !== undefined) {
        where.is_active = is_active === 'true' || is_active === true;
      } else {
        where.is_active = true;
      }

      if (is_perishable !== undefined) where.is_perishable = is_perishable === 'true' || is_perishable === true;

      const { rows: products, count } = await Product.findAndCountAll({
        where,
        include,
        attributes: posAttributes,
        distinct: true,
        subQuery: false,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['created_at', 'DESC']]
      });

      res.json({
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
          {
            model: Barcode,
            as: 'barcodes',
            where: { is_active: true },
            required: false
          },
          {
            model: Inventory,
            as: 'inventories',
            include: [{ model: Warehouse, as: 'warehouse' }]
          }
        ]
      });

      if (!product) {
        return res.status(404).json({
          message: 'Producto no encontrado'
        });
      }

      res.json({
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  // Create product
  async create(req, res, next) {
    const transaction = await sequelize.transaction();
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
        unit_size,
        unit_size_measure,
        // New: multiple presentations
        presentations: presentationsData
      } = req.body;

      // Basic validation
      if (!name || name.trim() === '') {
        await transaction.rollback();
        return res.status(400).json({ message: 'El nombre del producto es obligatorio' });
      }

      // Check for duplicate product name (including inactive)
      const existingProduct = await Product.findOne({
        where: { name: name.trim() }
      });
      if (existingProduct) {
        await transaction.rollback();
        const status = existingProduct.is_active ? 'activo' : 'inactivo';
        return res.status(409).json({
          message: `Ya existe un producto con el nombre "${name.trim()}" (${status}, SKU: ${existingProduct.sku})`,
          existingProductId: existingProduct.id
        });
      }

      if (!category_id) {
        await transaction.rollback();
        return res.status(400).json({ message: 'La categoría es obligatoria' });
      }
      if (unit_size === undefined || unit_size === null || unit_size === '') {
        await transaction.rollback();
        return res.status(400).json({ message: 'El tamaño de la unidad es obligatorio' });
      }

      // Parse presentations if provided as string (from FormData)
      let presentations = [];
      if (presentationsData) {
        try {
          presentations = typeof presentationsData === 'string'
            ? JSON.parse(presentationsData)
            : presentationsData;
        } catch (e) {
          await transaction.rollback();
          return res.status(400).json({ message: 'Formato de presentaciones inválido' });
        }
      }

      // Pre-validate presentations if they exist
      if (presentations.length > 0) {
        for (const p of presentations) {
          if (!p.units_per_package || p.units_per_package <= 0) {
            await transaction.rollback();
            return res.status(400).json({
              message: `La presentación "${p.name || 'sin nombre'}" debe tener una cantidad válida de unidades`
            });
          }
          if (!p.presentation_type_id) {
            await transaction.rollback();
            return res.status(400).json({
              message: `La presentación "${p.name || 'sin nombre'}" debe tener un tipo de unidad seleccionado`
            });
          }
        }
      }

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
          await transaction.rollback();
          return res.status(400).json({
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

      // Generate temporary SKU
      const tempSku = `TEMP-${Date.now()}`;

      // Create product
      const product = await Product.create({
        sku: tempSku,
        name,
        description,
        category_id,
        brand_id,
        unit_size: unit_size || null,
        unit_size_measure: unit_size_measure || 'UND',
        is_perishable,
        has_batch_control,
        min_stock,
        max_stock,
        reorder_point,
        image_url: finalImageUrl,
        created_by: req.user.id
      }, { transaction });

      // Create presentations if provided
      if (presentations.length > 0) {
        for (const p of presentations) {
          const unitsPerPkg = parseInt(p.units_per_package) || 1;
          await ProductPresentation.create({
            product_id: product.id,
            packaging_type_id: p.packaging_type_id || null,
            presentation_type_id: p.presentation_type_id || null,
            name: p.name || `${name} - ${unitsPerPkg} unidades`,
            units_per_package: unitsPerPkg,
            units_per_presentation: unitsPerPkg,
            package_price: p.package_price || 0,
            package_cost: p.package_cost || 0,
            base_price: p.package_price ? (parseFloat(p.package_price) / unitsPerPkg) : 0,
            cost: p.package_cost ? (parseFloat(p.package_cost) / unitsPerPkg) : 0,
            purchase_currency: p.purchase_currency || 'USD',
            is_default: p.is_default || false,
            is_active: true
          }, { transaction });
        }
      } else {
        // Fallback or old logic: check if single presentation fields are present in body
        const {
          packaging_type_id,
          presentation_type_id,
          units_per_package,
          package_price,
          package_cost,
          purchase_currency
        } = req.body;

        if (packaging_type_id || presentation_type_id || units_per_package) {
          const unitsPerPkg = parseInt(units_per_package) || 1;
          await ProductPresentation.create({
            product_id: product.id,
            packaging_type_id: packaging_type_id || null,
            presentation_type_id: presentation_type_id || null,
            name: `${name} - Presentación estándar`,
            units_per_package: unitsPerPkg,
            units_per_presentation: unitsPerPkg,
            package_price: package_price || 0,
            package_cost: package_cost || 0,
            base_price: package_price ? (parseFloat(package_price) / unitsPerPkg) : 0,
            cost: package_cost ? (parseFloat(package_cost) / unitsPerPkg) : 0,
            purchase_currency: purchase_currency || 'USD',
            is_default: true,
            is_active: true
          }, { transaction });
        }
      }

      // Create barcode record
      if (normalizedBarcode) {
        await Barcode.create({
          product_id: product.id,
          presentation_id: null,
          barcode: normalizedBarcode,
          type: 'EAN13',
          is_primary: true,
          is_active: true
        }, { transaction });
      }

      // Generate final SKU
      const finalSku = skuConfig.generate({
        brandName,
        productName: name,
        unit_size: unit_size || null,
        unit_size_measure: unit_size_measure || 'UND',
        brand_id: brand_id,
        existingSku: null
      });

      // Update product with final SKU
      await product.update({ sku: finalSku }, { transaction });

      await transaction.commit();

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

      res.status(201).json({
        message: 'Producto creado exitosamente',
        data: product
      });
    } catch (error) {
      await transaction.rollback();
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

      // Basic validation for updates
      if (updateData.name !== undefined && (!updateData.name || updateData.name.trim() === '')) {
        return res.status(400).json({ message: 'El nombre del producto no puede estar vacío' });
      }
      if (updateData.category_id !== undefined && !updateData.category_id) {
        return res.status(400).json({ message: 'La categoría no puede estar vacía' });
      }
      if (updateData.unit_size !== undefined && (updateData.unit_size === null || updateData.unit_size === '')) {
        return res.status(400).json({ message: 'El tamaño de la unidad no puede estar vacío' });
      }

      // Extract presentation fields (unit_size and unit_size_measure are now product fields)
      const {
        packaging_type_id,
        presentation_type_id,
        units_per_package,
        package_price,
        package_cost,
        purchase_currency
      } = updateData;

      // Remove presentation fields from product update (but keep unit_size and unit_size_measure)
      delete updateData.packaging_type_id;
      delete updateData.presentation_type_id;
      delete updateData.units_per_package;
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
          message: 'Producto no encontrado'
        });
      }

      // Update product
      await product.update({
        ...updateData,
        updated_by: req.user.id
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
          units_per_presentation: unitsPerPkg,
          package_price: package_price || 0,
          package_cost: package_cost || 0,
          base_price: package_price ? (parseFloat(package_price) / unitsPerPkg) : (defaultPresentation?.base_price || 0),
          cost: package_cost ? (parseFloat(package_cost) / unitsPerPkg) : (defaultPresentation?.cost || 0),
          purchase_currency: purchase_currency || 'USD'
        };

        if (defaultPresentation) {
          await defaultPresentation.update(presentationData);
        } else {
          // Solo crear si no existen presentaciones para este producto
          const anyPresentation = await ProductPresentation.findOne({
            where: { product_id: product.id },
            order: [['id', 'ASC']]
          });
          if (anyPresentation) {
            // Ya existen presentaciones — marcar la primera como default en lugar de crear una nueva
            await anyPresentation.update({ ...presentationData, is_default: true });
          } else {
            // Verdaderamente no hay ninguna presentación — crear la estándar
            await ProductPresentation.create({
              product_id: product.id,
              name: `${product.name} - Presentación estándar`,
              ...presentationData,
              is_default: true,
              is_active: true
            });
          }
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
              message: 'El código de barras ya está asignado a otro producto'
            });
          }

          // Deactivate other barcodes for this product since it's a replacement from the main form
          await Barcode.update(
            { is_primary: false, is_active: false },
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
        message: 'Producto actualizado exitosamente',
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
          message: 'Producto no encontrado'
        });
      }

      // Check if product has inventory
      const inventory = await Inventory.findOne({
        where: { product_id: id, quantity: { [Op.gt]: 0 } }
      });

      if (inventory) {
        return res.status(400).json({
          message: 'No se puede eliminar un producto con inventario existente'
        });
      }

      // Soft delete
      await product.update({ is_active: false });

      res.json({
        message: 'Producto eliminado exitosamente'
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
          where: { is_active: true },
          include: [
            { model: Category, as: 'category' },
            { model: ProductPresentation, as: 'presentations' }
          ]
        }]
      });

      if (barcodeRecord?.product) {
        return res.json({
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
          data: null,
          message: 'Barcode not found'
        });
      }

      return res.json({
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
          message: 'Producto no encontrado'
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
          message: 'Producto no encontrado'
        });
      }

      // If name is missing, generate one or use a default
      let presentationName = name;
      if (!presentationName || presentationName.trim() === '') {
        presentationName = `${product.name} - Presentación ${units_per_package || 1} unidades`;
      }

      if (units_per_package === undefined || units_per_package === null || units_per_package <= 0) {
        return res.status(400).json({ message: 'La cantidad de unidades por paquete debe ser mayor a 0' });
      }

      // If this is set as default, unmark all other presentations as default
      if (is_default) {
        await ProductPresentation.update(
          { is_default: false },
          { where: { product_id: id } }
        );
      }

      // Calculate base price and cost if not provided
      const unitsPerPkg = parseInt(units_per_package) || 1;
      const calcBasePrice = package_price ? (parseFloat(package_price) / unitsPerPkg) : 0;
      const calcCost = package_cost ? (parseFloat(package_cost) / unitsPerPkg) : 0;

      const presentation = await ProductPresentation.create({
        product_id: id,
        name: presentationName,
        packaging_type_id: packaging_type_id || null,
        presentation_type_id: presentation_type_id || null,
        units_per_package: unitsPerPkg,
        units_per_presentation: unitsPerPkg, // For compatibility
        package_price: package_price || 0,
        package_cost: package_cost || 0,
        base_price: calcBasePrice,
        cost: calcCost,
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
          message: 'Presentation not found'
        });
      }

      // Validaciones básicas para edición
      if (updateData.name !== undefined && (!updateData.name || updateData.name.trim() === '')) {
        return res.status(400).json({ message: 'El nombre de la presentación no puede estar vacío' });
      }

      if (updateData.units_per_package !== undefined && (updateData.units_per_package === null || updateData.units_per_package <= 0)) {
        return res.status(400).json({ message: 'La cantidad de unidades por paquete debe ser mayor a 0' });
      }

      // Update units_per_presentation if units_per_package is updated
      if (updateData.units_per_package !== undefined) {
        updateData.units_per_presentation = updateData.units_per_package;
      }

      // Si se está marcando como default, desmarcar las demás presentaciones del producto
      if (updateData.is_default === true) {
        await ProductPresentation.update(
          { is_default: false },
          { where: { product_id: presentation.product_id } }
        );
      }

      // Recalcular costo unitario y precio base cuando cambian los valores del paquete
      const finalUnitsPerPkg = parseInt(updateData.units_per_package ?? presentation.units_per_package) || 1;
      const finalPackageCost = parseFloat(updateData.package_cost ?? presentation.package_cost) || 0;
      const finalPackagePrice = parseFloat(updateData.package_price ?? presentation.package_price) || 0;

      // Siempre recalcular si alguno de los 3 campos relevantes cambia
      if (updateData.package_cost !== undefined || updateData.package_price !== undefined || updateData.units_per_package !== undefined) {
        updateData.cost = finalPackageCost / finalUnitsPerPkg;
        updateData.base_price = finalPackagePrice / finalUnitsPerPkg;
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
          message: 'Presentation not found'
        });
      }

      // Check if this is the last presentation for the product
      const presentationCount = await ProductPresentation.count({
        where: { product_id: presentation.product_id }
      });

      if (presentationCount <= 1) {
        return res.status(400).json({
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
        data: updatedPresentation,
        message: 'Default presentation updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async exportCSV(req, res, next) {
    try {
      const products = await Product.findAll({
        where: { is_active: true },
        include: [
          {
            model: ProductPresentation,
            as: 'presentations',
            where: { is_default: true },
            required: false
          },
          {
            model: Barcode,
            as: 'barcodes',
            where: { is_active: true },
            required: false
          }
        ]
      });

      // CSV Header
      let csvContent = 'ID Producto,SKU,Nombre,Descripcion,Tamano Unidad,Medida Unidad,ID Presentación,Unidades por Paquete,Unidades por Presentación,Costo Paquete,Costo Unitario,Moneda,ID Barcode,Codigo de Barras\n';

      products.forEach(product => {
        const defaultPresentation = product.presentations && product.presentations[0] ? product.presentations[0] : {};
        const barcodes = product.barcodes || [];

        // If there are multiple barcodes, we could list them all or just the primary one.
        // User asked for "id and barcode of each product", if there are many we list them separated by semicolon or multiple rows.
        // Let's go with one row per product and list barcodes separated by semicolon if there are multiple.
        const barcodeIds = barcodes.map(b => b.id).join('; ');
        const barcodeStrings = barcodes.map(b => b.barcode).join('; ');

        const row = [
          product.id,
          `"${product.sku}"`,
          `"${product.name}"`,
          `"${(product.description || '').replace(/"/g, '""')}"`,
          product.unit_size,
          `"${product.unit_size_measure || ''}"`,
          defaultPresentation.id || '',
          defaultPresentation.units_per_package || '',
          defaultPresentation.units_per_presentation || '',
          defaultPresentation.package_cost || '',
          defaultPresentation.cost || '',
          defaultPresentation.purchase_currency || '',
          `"${barcodeIds}"`,
          `"${barcodeStrings}"`
        ];

        csvContent += row.join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=productos_activos.csv');
      return res.status(200).send('\uFEFF' + csvContent);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductController();
