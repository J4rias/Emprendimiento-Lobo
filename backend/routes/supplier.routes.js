const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplier.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// All routes require authentication
router.use(auth);

// Get all suppliers with pagination and search
router.get('/', authorize('suppliers.view'), supplierController.getAll);

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
