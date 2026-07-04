const {
    PriceList,
    PriceListDetail,
    Product,
    ProductPresentation,
    Inventory,
    Permission,
    User,
    ExchangeRate
} = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../config/logger');

class PriceListController {
    constructor() {
        this.getAll = this.getAll.bind(this);
        this.getById = this.getById.bind(this);
        this.create = this.create.bind(this);
        this.update = this.update.bind(this);
        this.updateDetail = this.updateDetail.bind(this);
        this.duplicate = this.duplicate.bind(this);
        this.getActive = this.getActive.bind(this);
        this.getProductsWithStock = this.getProductsWithStock.bind(this);
        this.exportCSV = this.exportCSV.bind(this);
        this.delete = this.delete.bind(this);
    }

    // GET /api/price-lists/products-with-stock
    async getProductsWithStock(req, res, next) {
        try {
            const products = await this._getProductsWithStock();
            res.json({ data: products });
        } catch (error) {
            next(error);
        }
    }

    // GET /api/price-lists
    async getAll(req, res, next) {
        try {
            const { search, status, page = 1, limit = 20 } = req.query;
            const where = { isDeleted: false };
            const andConditions = [];

            // Search filter
            if (search && search.trim() !== '') {
                andConditions.push({
                    [Op.or]: [
                        { name: { [Op.like]: `%${search}%` } },
                        { code: { [Op.like]: `%${search}%` } }
                    ]
                });
            }

            // Status filter
            if (status === 'active') {
                where.status = 'active';
                andConditions.push({
                    [Op.or]: [
                        { validUntil: null },
                        { validUntil: { [Op.gte]: new Date() } }
                    ]
                });
            } else if (status === 'inactive') {
                where.status = 'inactive';
            } else if (status === 'expired') {
                where.status = 'active';
                andConditions.push({
                    validUntil: {
                        [Op.and]: [
                            { [Op.ne]: null },
                            { [Op.lt]: new Date() }
                        ]
                    }
                });
            }

            if (andConditions.length > 0) {
                where[Op.and] = andConditions;
            }

            const offset = (parseInt(page) - 1) * parseInt(limit);
            const { count, rows } = await PriceList.findAndCountAll({
                where,
                include: [
                    { model: User, as: 'updater', attributes: ['id', 'username', 'first_name', 'last_name'] }
                ],
                order: [['updated_at', 'DESC']],
                limit: parseInt(limit),
                offset
            });

            res.json({
                data: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    totalPages: Math.ceil(count / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /api/price-lists/active - Only active and valid (for POS)
    async getActive(req, res, next) {
        try {
            const now = new Date();
            const lists = await PriceList.findAll({
                where: {
                    isDeleted: false,
                    status: 'active',
                    [Op.or]: [
                        { validUntil: null },
                        { validUntil: { [Op.gte]: now } }
                    ]
                },
                attributes: ['id', 'code', 'name', 'currency', 'isDefault', 'validFrom', 'validUntil', 'validity_days'],
                order: [['isDefault', 'DESC'], ['name', 'ASC']]
            });

            res.json({ data: lists });
        } catch (error) {
            next(error);
        }
    }

    // GET /api/price-lists/:id
    async getById(req, res, next) {
        try {
            const { id } = req.params;

            const priceList = await PriceList.findOne({
                where: { id, isDeleted: false },
                include: [
                    { model: User, as: 'updater', attributes: ['id', 'username', 'first_name', 'last_name'] },
                    {
                        model: PriceListDetail,
                        as: 'details',
                        include: [
                            {
                                model: Product,
                                as: 'product',
                                where: { is_active: true },
                                attributes: ['id', 'sku', 'name', 'image_url']
                            },
                            {
                                model: ProductPresentation,
                                as: 'presentation',
                                attributes: ['id', 'name', 'units_per_package', 'package_cost', 'cost', 'purchase_currency']
                            }
                        ]
                    }
                ]
            });

            if (!priceList) {
                return res.status(404).json({ message: 'Lista de precios no encontrada' });
            }

            res.json({ data: priceList });
        } catch (error) {
            next(error);
        }
    }

    // POST /api/price-lists
    async create(req, res, next) {
        const transaction = await sequelize.transaction();
        try {
            const {
                name, description, basePercentage,
                isDefault, validity_days, details
            } = req.body;

            if (!name || !name.trim()) {
                await transaction.rollback();
                return res.status(400).json({ message: 'El nombre es obligatorio' });
            }

            // Create the price list header - Always USD
            const validFrom = new Date();
            const priceList = await PriceList.create({
                name: name.trim(),
                description: description || null,
                currency: 'USD',
                basePercentage: basePercentage || 0,
                isDefault: isDefault || false,
                validity_days: validity_days || 5,
                validFrom,
                status: 'active',
                updated_by: req.user.id
            }, { transaction });

            // If details provided, create them
            if (details && details.length > 0) {
                const detailRecords = details.map(d => ({
                    price_list_id: priceList.id,
                    product_id: d.product_id,
                    presentation_id: d.presentation_id,
                    package_cost: d.package_cost || 0,
                    unit_cost: d.unit_cost || 0,
                    package_price: d.package_price || 0,
                    unit_price: d.unit_price || 0,
                    margin_percentage: d.margin_percentage || 0,
                    is_frozen: d.is_frozen || false,
                    frozen_price: d.frozen_price || null,
                    frozen_currency: d.frozen_currency || 'USD'
                }));
                await PriceListDetail.bulkCreate(detailRecords, { transaction });
            } else {
                // Auto-generate from products with stock using basePercentage
                const productsWithStock = await this._getProductsWithStock();
                if (productsWithStock.length > 0) {
                    const marginPct = parseFloat(basePercentage) || 0;
                    const autoDetails = [];
                    for (const item of productsWithStock) {
                        const pkgCost = parseFloat(item.presentation.package_cost) || 0;
                        const unitCost = parseFloat(item.presentation.cost) || 0;
                        
                        let usdPkgCost = pkgCost;
                        let usdUnitCost = unitCost;

                        if (item.presentation.purchase_currency && item.presentation.purchase_currency !== 'USD') {
                            try {
                                usdPkgCost = await ExchangeRate.convert(pkgCost, item.presentation.purchase_currency, 'USD');
                                usdUnitCost = await ExchangeRate.convert(unitCost, item.presentation.purchase_currency, 'USD');
                            } catch (e) {
                                // Default back or ignore if no rate
                                logger.error(`Failed to convert cost for ${item.product_id} to USD`, e.message);
                            }
                        }

                        const pkgPrice = usdPkgCost > 0 ? usdPkgCost * (1 + marginPct / 100) : 0;
                        const unitPrice = usdUnitCost > 0 ? usdUnitCost * (1 + marginPct / 100) : 0;
                        const margin = usdPkgCost > 0 ? ((pkgPrice - usdPkgCost) / usdPkgCost * 100) : 0;

                        autoDetails.push({
                            price_list_id: priceList.id,
                            product_id: item.product_id,
                            presentation_id: item.presentation.id,
                            package_cost: Math.round(pkgCost * 100) / 100, // Kept in native currency
                            unit_cost: Math.round(unitCost * 100) / 100, // Kept in native currency
                            package_price: Math.round(pkgPrice * 100) / 100, // In USD
                            unit_price: Math.round(unitPrice * 100) / 100, // In USD
                            margin_percentage: Math.round(margin * 10) / 10
                        });
                    }
                    await PriceListDetail.bulkCreate(autoDetails, { transaction });
                }
            }

            await transaction.commit();

            // Re-fetch with details
            const created = await PriceList.findByPk(priceList.id, {
                include: [
                    {
                        model: PriceListDetail, as: 'details',
                        include: [
                            { model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'image_url'] },
                            { model: ProductPresentation, as: 'presentation', attributes: ['id', 'name', 'units_per_package', 'package_cost', 'cost', 'purchase_currency'] }
                        ]
                    }
                ]
            });

            res.status(201).json({ data: created });
        } catch (error) {
            await transaction.rollback();
            next(error);
        }
    }

    // PUT /api/price-lists/:id
    async update(req, res, next) {
        const transaction = await sequelize.transaction();
        try {
            const { id } = req.params;
            const {
                name, description, basePercentage,
                isDefault, validity_days, status, details, renewValidity
            } = req.body;

            const priceList = await PriceList.findOne({
                where: { id, isDeleted: false },
                transaction
            });

            if (!priceList) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Lista de precios no encontrada' });
            }

            // Update header
            const updateData = { updated_by: req.user.id };
            if (name !== undefined) updateData.name = name.trim();
            if (description !== undefined) updateData.description = description;
            // currency is hardcoded to USD, so it's not updated here
            if (basePercentage !== undefined) updateData.basePercentage = basePercentage;
            if (isDefault !== undefined) updateData.isDefault = isDefault;
            if (validity_days !== undefined) updateData.validity_days = validity_days;
            if (status !== undefined) updateData.status = status;

            // Renew validity on update
            if (renewValidity || status === 'active') {
                updateData.validFrom = new Date();
                updateData.validity_days = validity_days || priceList.validity_days;
            }

            await priceList.update(updateData, { transaction });

            // Update details if provided
            if (details && details.length > 0) {
                // Delete existing details and recreate
                await PriceListDetail.destroy({ where: { price_list_id: id }, transaction });
                const detailRecords = details.map(d => ({
                    price_list_id: parseInt(id),
                    product_id: d.product_id,
                    presentation_id: d.presentation_id,
                    package_cost: d.package_cost || 0,
                    unit_cost: d.unit_cost || 0,
                    package_price: d.package_price || 0,
                    unit_price: d.unit_price || 0,
                    margin_percentage: d.margin_percentage || 0,
                    is_frozen: d.is_frozen || false,
                    frozen_price: d.frozen_price || null,
                    frozen_currency: d.frozen_currency || 'USD'
                }));
                await PriceListDetail.bulkCreate(detailRecords, { transaction });
            }

            await transaction.commit();

            // Re-fetch
            const updated = await PriceList.findByPk(id, {
                include: [
                    { model: User, as: 'updater', attributes: ['id', 'username', 'first_name', 'last_name'] },
                    {
                        model: PriceListDetail, as: 'details',
                        include: [
                            { model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'image_url'] },
                            { model: ProductPresentation, as: 'presentation', attributes: ['id', 'name', 'units_per_package', 'package_cost', 'cost', 'purchase_currency'] }
                        ]
                    }
                ]
            });

            res.json({ data: updated });
        } catch (error) {
            await transaction.rollback();
            next(error);
        }
    }

    // POST /api/price-lists/:id/duplicate
    async duplicate(req, res, next) {
        const transaction = await sequelize.transaction();
        try {
            const { id } = req.params;
            const { name } = req.body;

            const original = await PriceList.findOne({
                where: { id, isDeleted: false },
                include: [{ model: PriceListDetail, as: 'details' }]
            });

            if (!original) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Lista de precios no encontrada' });
            }

            const newList = await PriceList.create({
                name: name || `${original.name} (Copia)`,
                description: original.description,
                currency: 'USD',
                basePercentage: original.basePercentage,
                isDefault: false,
                validity_days: original.validity_days,
                validFrom: new Date(),
                status: 'active',
                updated_by: req.user.id
            }, { transaction });

            // Copy details
            if (original.details && original.details.length > 0) {
                const copiedDetails = original.details.map(d => ({
                    price_list_id: newList.id,
                    product_id: d.product_id,
                    presentation_id: d.presentation_id,
                    package_cost: d.package_cost,
                    unit_cost: d.unit_cost,
                    package_price: d.package_price,
                    unit_price: d.unit_price,
                    margin_percentage: d.margin_percentage,
                    is_frozen: d.is_frozen,
                    frozen_price: d.frozen_price,
                    frozen_currency: d.frozen_currency
                }));
                await PriceListDetail.bulkCreate(copiedDetails, { transaction });
            }

            await transaction.commit();

            const created = await PriceList.findByPk(newList.id, {
                include: [
                    {
                        model: PriceListDetail, as: 'details',
                        include: [
                            { model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'image_url'] },
                            { model: ProductPresentation, as: 'presentation', attributes: ['id', 'name', 'units_per_package', 'package_cost', 'cost', 'purchase_currency'] }
                        ]
                    }
                ]
            });

            res.status(201).json({ data: created });
        } catch (error) {
            await transaction.rollback();
            next(error);
        }
    }

    // DELETE /api/price-lists/:id (soft delete)
    async delete(req, res, next) {
        try {
            const { id } = req.params;
            const priceList = await PriceList.findOne({ where: { id, isDeleted: false } });

            if (!priceList) {
                return res.status(404).json({ message: 'Lista de precios no encontrada' });
            }

            await priceList.update({ isDeleted: true, status: 'inactive' });

            res.json({ message: 'Lista de precios eliminada' });
        } catch (error) {
            next(error);
        }
    }

    // GET /api/price-lists/:id/export/csv
    async exportCSV(req, res, next) {
        try {
            const { id } = req.params;
            const priceList = await PriceList.findOne({
                where: { id, isDeleted: false },
                include: [
                    {
                        model: PriceListDetail, as: 'details',
                        include: [
                            { model: Product, as: 'product', attributes: ['id', 'sku', 'name'] },
                            { model: ProductPresentation, as: 'presentation', attributes: ['id', 'name', 'units_per_package'] }
                        ]
                    }
                ]
            });

            if (!priceList) {
                return res.status(404).json({ message: 'Lista de precios no encontrada' });
            }

            // Get product IDs to fetch inventory
            const productIds = priceList.details.map(d => d.product?.id).filter(Boolean);

            // Fetch total inventory per product
            let inventoryByProduct = {};
            if (productIds.length > 0) {
                const inventories = await Inventory.findAll({
                    where: { product_id: productIds },
                    attributes: ['product_id', [sequelize.fn('SUM', sequelize.col('quantity')), 'total_quantity']],
                    group: ['product_id']
                });

                inventories.forEach(inv => {
                    inventoryByProduct[inv.product_id] = parseFloat(inv.get('total_quantity')) || 0;
                });
            }

            // Convert to COP if needed
            let rateToCop = 1;
            if (priceList.currency && priceList.currency !== 'COP') {
                try {
                    rateToCop = await ExchangeRate.getRate(priceList.currency, 'COP');
                } catch (e) {
                    logger.error('Failed to get exchange rate to COP for CSV export', e);
                }
            }

            // Build CSV
            const headers = ['SKU', 'Producto', 'Presentación', 'Existencia (Paquetes)', 'Existencia (Unidades)', 'Uds/Paquete', `Costo/Paquete (${priceList.currency})`, `Costo/Paquete (COP)`, `Costo Unitario (${priceList.currency})`, `Costo Unitario (COP)`, `Precio/Paquete (${priceList.currency})`, `Precio/Paquete (COP)`, 'Precio/Paquete (USD directo)', `Precio Unitario (${priceList.currency})`, `Precio Unitario (COP)`, 'Margen COP %', 'Margen USD %'];

            const rows = await Promise.all(priceList.details.map(async d => {
                const unitsPerPackage = d.presentation?.units_per_package || 1;
                const totalLooseUnits = inventoryByProduct[d.product?.id] || 0;

                const stockPackages = Math.floor(totalLooseUnits / unitsPerPackage);
                const stockRemainingUnits = totalLooseUnits % unitsPerPackage;

                let nativeCost = parseFloat(d.package_cost) || 0;
                let nativeUnitCost = parseFloat(d.unit_cost) || 0;
                let nativeCurrency = d.presentation?.purchase_currency || 'USD';
                
                let costInListCurrency = nativeCost;
                let costInCop = nativeCost;
                let unitCostInListCurrency = nativeUnitCost;
                let unitCostInCop = nativeUnitCost;
                
                if (nativeCurrency !== priceList.currency) {
                    try {
                        costInListCurrency = await ExchangeRate.convert(nativeCost, nativeCurrency, priceList.currency);
                        unitCostInListCurrency = await ExchangeRate.convert(nativeUnitCost, nativeCurrency, priceList.currency);
                    } catch(e) { logger.error(e.message); }
                }
                if (nativeCurrency !== 'COP') {
                    try {
                        costInCop = await ExchangeRate.convert(nativeCost, nativeCurrency, 'COP');
                        unitCostInCop = await ExchangeRate.convert(nativeUnitCost, nativeCurrency, 'COP');
                    } catch(e) { logger.error(e.message); }
                }

                const pkgPriceUsd = parseFloat(d.package_price_usd) || 0;
                const costUsd = costInListCurrency; // list currency is USD
                const marginCop = parseFloat(d.margin_percentage) || 0;
                const marginUsd = costUsd > 0 ? ((pkgPriceUsd - costUsd) / costUsd * 100) : 0;

                return [
                    d.product?.sku || '',
                    `"${(d.product?.name || '').replace(/"/g, '""')}"`,
                    `"${(d.presentation?.name || '').replace(/"/g, '""')}"`,
                    stockPackages,
                    stockRemainingUnits,
                    unitsPerPackage,
                    costInListCurrency.toFixed(2),
                    costInCop.toFixed(2),
                    unitCostInListCurrency.toFixed(2),
                    unitCostInCop.toFixed(2),
                    parseFloat(d.package_price).toFixed(2),
                    (parseFloat(d.package_price) * rateToCop).toFixed(2),
                    pkgPriceUsd.toFixed(2),
                    parseFloat(d.unit_price).toFixed(2),
                    (parseFloat(d.unit_price) * rateToCop).toFixed(2),
                    marginCop.toFixed(1),
                    marginUsd.toFixed(1)
                ].join(',');
            }));

            const csv = [headers.join(','), ...rows].join('\n');

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="lista-precios-${priceList.code}.csv"`);
            res.send('\uFEFF' + csv); // BOM for Excel UTF-8
        } catch (error) {
            next(error);
        }
    }

    // PATCH /api/price-lists/:id/detail
    async updateDetail(req, res, next) {
        try {
            const { id } = req.params;
            const {
                presentation_id,
                product_id,
                client_updated_at,
                package_cost,
                unit_cost,
                package_price,
                unit_price,
                margin_percentage,
                is_frozen,
                frozen_price,
                frozen_currency,
                package_price_usd
            } = req.body;

            if (!presentation_id || !product_id) {
                return res.status(400).json({ message: 'presentation_id y product_id son requeridos' });
            }

            // Verificar que la lista existe y no está eliminada
            const priceList = await PriceList.findOne({ where: { id, isDeleted: false } });
            if (!priceList) {
                return res.status(404).json({ message: 'Lista de precios no encontrada' });
            }

            // Buscar el detail existente para optimistic locking
            const existing = await PriceListDetail.findOne({
                where: { price_list_id: id, presentation_id }
            });

            // Optimistic locking: si el DB tiene un updated_at más reciente que el cliente → conflicto
            if (existing && client_updated_at) {
                const dbUpdatedAt = new Date(existing.updatedAt).getTime();
                const clientUpdatedAt = new Date(client_updated_at).getTime();
                if (dbUpdatedAt > clientUpdatedAt) {
                    return res.status(409).json({
                        conflict: true,
                        message: 'Otro usuario modificó este precio. Recarga para ver los cambios.',
                        current: existing
                    });
                }
            }

            // Upsert: actualiza si existe, inserta si no existe
            const upsertData = {
                price_list_id: parseInt(id),
                presentation_id: parseInt(presentation_id),
                product_id: parseInt(product_id),
                package_cost: parseFloat(package_cost) || 0,
                unit_cost: parseFloat(unit_cost) || 0,
                package_price: parseFloat(package_price) || 0,
                unit_price: parseFloat(unit_price) || 0,
                margin_percentage: parseFloat(margin_percentage) || 0,
                is_frozen: is_frozen || false,
                frozen_price: frozen_price ? parseFloat(frozen_price) : null,
                frozen_currency: frozen_currency || 'USD'
            };
            if (package_price_usd !== undefined) {
                upsertData.package_price_usd = parseFloat(package_price_usd) || 0;
            }
            const [detail] = await PriceListDetail.upsert(upsertData, { returning: true });

            res.json({ data: detail });
        } catch (error) {
            next(error);
        }
    }

    // Helper: Get products with stock
    async _getProductsWithStock() {
        const inventories = await Inventory.findAll({
            where: { quantity: { [Op.gt]: 0 } },
            attributes: ['product_id'],
            include: [
                {
                    model: Product,
                    as: 'product',
                    where: { is_active: true },
                    attributes: ['id', 'sku', 'name']
                }
            ],
            group: ['product_id']
        });

        // For each product with inventory, get its presentations
        const results = [];
        const seenPresentations = new Set();

        for (const inv of inventories) {
            const presentations = await ProductPresentation.findAll({
                where: {
                    product_id: inv.product_id,
                    is_active: true
                },
                attributes: ['id', 'name', 'units_per_package', 'package_cost', 'cost', 'purchase_currency']
            });

            for (const p of presentations) {
                const key = `${inv.product_id}-${p.id}`;
                if (!seenPresentations.has(key)) {
                    seenPresentations.add(key);

                    results.push({
                        product_id: inv.product_id,
                        product: inv.product,
                        presentation: {
                            ...p.get(), // Get plain data from Sequelize instance
                            package_cost: p.package_cost,
                            cost: p.cost
                        }
                    });
                }
            }
        }

        return results;
    }
}

module.exports = new PriceListController();
