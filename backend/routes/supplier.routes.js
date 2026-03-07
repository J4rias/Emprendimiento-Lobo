const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplier.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// All routes require authentication
router.use(auth);

// Get all suppliers with pagination and search
router.get('/', authorize('suppliers.view'), supplierController.getAll);

// Get active suppliers for dropdowns
router.get('/active', authorize('suppliers.view'), supplierController.getActive);

// Get supplier by ID
router.get('/:id', authorize('suppliers.view'), supplierController.getById);

// Get supplier statement (ledger)
router.get('/:id/statement', authorize('suppliers.view'), supplierController.getStatement);

// Create new supplier
router.post('/', authorize('suppliers.create'), supplierController.create);

// Update supplier
router.put('/:id', authorize('suppliers.update'), supplierController.update);

// Delete supplier (soft delete)
router.delete('/:id', authorize('suppliers.delete'), supplierController.deleteSupplier);

module.exports = router;
