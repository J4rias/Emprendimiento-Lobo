const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplier.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const logger = require('../config/logger');

// All routes require authentication
router.use(auth);

// Get all suppliers with pagination and search
router.get('/', authorize('suppliers.view'), supplierController.getAll);

// Get active suppliers for dropdowns
// DEPRECATED: use GET /api/suppliers?is_active=true instead
router.get('/active', authorize('suppliers.view'), (req, res, next) => {
  logger.warn('[DEPRECATED] GET /api/suppliers/active — use GET /api/suppliers?is_active=true');
  next();
}, supplierController.getActive);

// Resumen de proveedores - saldos por categoría (USD/DIVISAS/COP)
router.get('/resumen', authorize('suppliers.view'), supplierController.getResumen);

// Get supplier by ID
router.get('/:id', authorize('suppliers.view'), supplierController.getById);

// Get supplier statement (legacy unified ledger)
router.get('/:id/statement', authorize('suppliers.view'), supplierController.getStatement);

// Get supplier ledger grouped by category (USD/DIVISAS/COP) - matches spreadsheet layout
router.get('/:id/ledger', authorize('suppliers.view'), supplierController.getLedger);

// Create new supplier
router.post('/', authorize('suppliers.create'), supplierController.create);

// Update supplier
router.put('/:id', authorize('suppliers.update'), supplierController.update);

// Delete supplier (soft delete)
router.delete('/:id', authorize('suppliers.delete'), supplierController.deleteSupplier);

module.exports = router;
