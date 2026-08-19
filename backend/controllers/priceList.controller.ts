// Express type imports (ALWAYS at the top)
import { Request, Response, NextFunction } from 'express';

// Sequelize imports (only what is used in the controller)
import { Op } from 'sequelize';

// Model imports (esModuleInterop — require with export = in the .ts files)
import PriceList from '../models/PriceList';
import PriceListDetail from '../models/PriceListDetail';
import Product from '../models/Product';
import ProductPresentation from '../models/ProductPresentation';
import User from '../models/User';
import ExchangeRate from '../models/ExchangeRate';

// Other requires that are not models/sequelize/express → leave as require()
const logger = require('../config/logger');
const { sequelize } = require('../config/database');
const { getProductsWithStock: _getProductsWithStock, exportPriceListCSV } = require('../services/priceList.service');

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
    async getProductsWithStock(req: Request, res: Response, next: NextFunction) {
        try {
            const products = await _getProductsWithStock();
            res.json({ data: products });
        } catch (error) {
            next(error);
        }
    }

    // GET /api/price-lists
    async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const { search, status, page = '1', limit = '20', sort_by = 'updated_at', sort_dir = 'DESC' } = req.query as Record<string, string>;
            const where: any = {};
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
                        { valid_until: null },
                        { valid_until: { [Op.gte]: new Date() } }
                    ]
                });
            } else if (status === 'inactive') {
                where.status = 'inactive';
            } else if (status === 'expired') {
                where.status = 'active';
                andConditions.push({
                    valid_until: {
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

            const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
            const { count, rows } = await PriceList.findAndCountAll({
                where,
                include: [
                    { model: User, as: 'updater', attributes: ['id', 'username', 'first_name', 'last_name'] }
                ],
                order: [[sort_by, sort_dir.toUpperCase()] as [string, string]],
                limit: parseInt(limit, 10),
                offset
            }) as any;

            res.json({
                data: rows,
                pagination: {
                    total: count,
                    page: parseInt(page, 10),
                    totalPages: Math.ceil(count / parseInt(limit, 10)),
                    limit: parseInt(limit, 10)
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /api/price-lists/active - Only active and valid (for POS)
    async getActive(req: Request, res: Response, next: NextFunction) {
        try {
            const now = new Date();
            const lists = await PriceList.findAll({
                where: {
                    status: 'active',
                    [Op.or]: [
                        { valid_until: null },
                        { valid_until: { [Op.gte]: now } }
                    ]
                },
                attributes: ['id', 'code', 'name', 'currency', 'is_default', 'valid_from', 'valid_until', 'validity_days'],
                order: [['is_default', 'DESC'], ['name', 'ASC']]
            }) as any[];

            res.json({ data: lists });
        } catch (error) {
            next(error);
        }
    }

    // GET /api/price-lists/:id
    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;

            const priceList = await PriceList.findOne({
                where: { id },
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
                                attributes: ['id', 'name', 'units_per_package', 'package_cost', 'cost', 'purchase_currency', 'package_commission', 'unit_commission']
                            }
                        ]
                    }
                ]
            }) as any;

            if (!priceList) {
                return res.status(404).json({ message: 'Lista de precios no encontrada' });
            }

            res.json({ data: priceList });
        } catch (error) {
            next(error);
        }
    }

    // POST /api/price-lists
    async create(req: Request, res: Response, next: NextFunction) {
        const transaction = await sequelize.transaction();
        try {
            const {
                name, description, base_percentage,
                is_default, validity_days, details
            } = req.body;

            if (!name || !name.trim()) {
                await transaction.rollback();
                return res.status(400).json({ message: 'El nombre es obligatorio' });
            }

            // Create the price list header - Always USD
            const valid_from = new Date();
            const priceList = await PriceList.create({
                name: name.trim(),
                description: description || null,
                currency: 'USD',
                base_percentage: base_percentage || 0,
                is_default: is_default || false,
                validity_days: validity_days || 5,
                valid_from,
                status: 'active',
                updated_by: (req as any).user.id
            } as any, { transaction }) as any;

            // If details provided, create them
            if (details && details.length > 0) {
                const detailRecords = details.map((d: any) => ({
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
                // Auto-generate from products with stock using base_percentage
                const productsWithStock = await _getProductsWithStock();
                if (productsWithStock.length > 0) {
                    const marginPct = parseFloat(base_percentage) || 0;
                    const autoDetails = [];
                    for (const item of productsWithStock) {
                        const pkgCost = parseFloat(item.presentation.package_cost) || 0;
                        const unitCost = parseFloat(item.presentation.cost) || 0;

                        let usdPkgCost = pkgCost;
                        let usdUnitCost = unitCost;

                        if (item.presentation.purchase_currency && item.presentation.purchase_currency !== 'USD') {
                            try {
                                usdPkgCost = await (ExchangeRate as any).convert(pkgCost, item.presentation.purchase_currency, 'USD');
                                usdUnitCost = await (ExchangeRate as any).convert(unitCost, item.presentation.purchase_currency, 'USD');
                            } catch (e) {
                                // Default back or ignore if no rate
                                logger.error(`Failed to convert cost for ${item.product_id} to USD`, (e as Error).message);
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
            }) as any;

            res.status(201).json({ data: created });
        } catch (error) {
            await transaction.rollback();
            next(error);
        }
    }

    // PUT /api/price-lists/:id
    async update(req: Request, res: Response, next: NextFunction) {
        const transaction = await sequelize.transaction();
        try {
            const { id } = req.params;
            const {
                name, description, base_percentage,
                is_default, validity_days, status, details, renewValidity
            } = req.body;

            const priceList = await PriceList.findOne({
                where: { id },
                transaction
            }) as any;

            if (!priceList) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Lista de precios no encontrada' });
            }

            // Update header
            const updateData: any = { updated_by: (req as any).user.id };
            if (name !== undefined) updateData.name = name.trim();
            if (description !== undefined) updateData.description = description;
            // currency is hardcoded to USD, so it's not updated here
            if (base_percentage !== undefined) updateData.base_percentage = base_percentage;
            if (is_default !== undefined) updateData.is_default = is_default;
            if (validity_days !== undefined) updateData.validity_days = validity_days;
            if (status !== undefined) updateData.status = status;

            // Renew validity on update
            if (renewValidity || status === 'active') {
                updateData.valid_from = new Date();
                updateData.validity_days = validity_days || priceList.validity_days;
            }

            await priceList.update(updateData, { transaction });

            // Update details if provided
            if (details && details.length > 0) {
                // Delete existing details and recreate
                await PriceListDetail.destroy({ where: { price_list_id: id }, transaction });
                const detailRecords = details.map((d: any) => ({
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
            }) as any;

            res.json({ data: updated });
        } catch (error) {
            await transaction.rollback();
            next(error);
        }
    }

    // POST /api/price-lists/:id/duplicate
    async duplicate(req: Request, res: Response, next: NextFunction) {
        const transaction = await sequelize.transaction();
        try {
            const { id } = req.params;
            const { name } = req.body;

            const original = await PriceList.findOne({
                where: { id },
                include: [{ model: PriceListDetail, as: 'details' }]
            }) as any;

            if (!original) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Lista de precios no encontrada' });
            }

            const newList = await PriceList.create({
                name: name || `${original.name} (Copia)`,
                description: original.description,
                currency: 'USD',
                base_percentage: original.base_percentage,
                is_default: false,
                validity_days: original.validity_days,
                valid_from: new Date(),
                status: 'active',
                updated_by: (req as any).user.id
            } as any, { transaction }) as any;

            // Copy details
            if (original.details && original.details.length > 0) {
                const copiedDetails = original.details.map((d: any) => ({
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
                            { model: ProductPresentation, as: 'presentation', attributes: ['id', 'name', 'units_per_package'] }
                        ]
                    }
                ]
            }) as any;

            res.status(201).json({ data: created });
        } catch (error) {
            await transaction.rollback();
            next(error);
        }
    }

    // DELETE /api/price-lists/:id (soft delete)
    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const priceList = await PriceList.findByPk(id) as any;

            if (!priceList) {
                return res.status(404).json({ message: 'Lista de precios no encontrada' });
            }

            // La lista por defecto sostiene los precios del POS: sin ella el sistema queda sin tarifa base
            if (priceList.is_default) {
                return res.status(400).json({
                    message: 'No se puede eliminar la lista de precios por defecto. Marca otra como predeterminada primero.'
                });
            }

            await priceList.destroy();

            res.json({ message: 'Lista de precios eliminada' });
        } catch (error) {
            next(error);
        }
    }

    // GET /api/price-lists/:id/export/csv
    async exportCSV(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const result = await exportPriceListCSV(id);
            if (!result) return res.status(404).json({ message: 'Lista de precios no encontrada' });

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            return res.send(result.csv);
        } catch (error) {
            next(error);
        }
    }

    // PATCH /api/price-lists/:id/detail
    async updateDetail(req: Request, res: Response, next: NextFunction) {
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
            const priceList = await PriceList.findByPk(id) as any;
            if (!priceList) {
                return res.status(404).json({ message: 'Lista de precios no encontrada' });
            }

            // Buscar el detail existente para optimistic locking
            const existing = await PriceListDetail.findOne({
                where: { price_list_id: id, presentation_id }
            }) as any;

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
            const upsertData: any = {
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
            const [detail] = await PriceListDetail.upsert(upsertData, { returning: true }) as any;

            res.json({ data: detail });
        } catch (error) {
            next(error);
        }
    }

}

export = new PriceListController();