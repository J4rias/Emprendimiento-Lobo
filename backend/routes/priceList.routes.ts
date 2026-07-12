import { Router } from 'express';
const priceListController = require('../controllers/priceList.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

import validateZod from '../middleware/validateZod';
import { CreatePriceListSchema, UpdatePriceListSchema, UpdateDetailSchema, DuplicatePriceListSchema } from '../schemas/priceList.schema';

const router = Router();

// Get active price lists (for POS) – must be BEFORE /:id
router.get(
    '/active',
    authenticate,
    authorize('sales.create'),
    priceListController.getActive
);

// Get products with stock for new list - must be BEFORE /:id
router.get(
    '/products-with-stock',
    authenticate,
    authorize('price_lists.view'),
    priceListController.getProductsWithStock
);

// Get all price lists
router.get(
    '/',
    authenticate,
    authorize('price_lists.view'),
    priceListController.getAll
);

// Get price list by ID
router.get(
    '/:id',
    authenticate,
    authorize('price_lists.view', 'sales.create'),
    priceListController.getById
);

// Create price list
router.post(
    '/',
    authenticate,
    authorize('price_lists.create'),
    validateZod(CreatePriceListSchema),
    priceListController.create
);

// Update price list
router.put(
    '/:id',
    authenticate,
    authorize('price_lists.update'),
    validateZod(UpdatePriceListSchema),
    priceListController.update
);

// Update a single detail (auto-save por fila con optimistic locking)
router.patch(
    '/:id/detail',
    authenticate,
    authorize('price_lists.update'),
    validateZod(UpdateDetailSchema),
    priceListController.updateDetail
);

// Duplicate price list
router.post(
    '/:id/duplicate',
    authenticate,
    authorize('price_lists.create'),
    validateZod(DuplicatePriceListSchema),
    priceListController.duplicate
);

// Export CSV
router.get(
    '/:id/export/csv',
    authenticate,
    authorize('price_lists.view'),
    priceListController.exportCSV
);

// Delete price list
router.delete(
    '/:id',
    authenticate,
    authorize('price_lists.delete'),
    priceListController.delete
);

export = router;
