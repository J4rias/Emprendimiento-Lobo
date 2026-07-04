const express = require('express');
const { body } = require('express-validator');
const inventoryController = require('../controllers/inventory.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const router = express.Router();

// All routes require authentication
router.use(auth);

// Get all warehouses
router.get('/warehouses', inventoryController.getWarehouses);

// Main inventory endpoint — supports ?warehouse_id=X and ?product_id=X
router.get('/', inventoryController.getByQuery);

// Get low stock products
router.get('/alerts/low-stock', inventoryController.getLowStock);

// Get expiring products
router.get('/alerts/expiring', inventoryController.getExpiringProducts);

// Get inventory valuation
router.get('/valuation', inventoryController.getValuation);

// Get inventory movements history
router.get('/movements', inventoryController.getMovements);

// Get inventory by ID (must be last)
router.get('/:id',
  authorize('inventory.view'),
  inventoryController.getById
);

// Adjust inventory
router.post('/adjust',
  authorize('inventory.adjust'),
  [
    body('product_id').isInt().withMessage('Product ID must be an integer'),
    body('warehouse_id').isInt().withMessage('Warehouse ID must be an integer'),
    body('type').isIn(['add', 'remove']).withMessage('Type must be "add" or "remove"'),
    body('presentation_id').optional().isInt().withMessage('Presentation ID must be an integer'),
    body('package_quantity').optional().isDecimal().withMessage('Package quantity must be a decimal'),
    body('loose_units').optional().isDecimal().withMessage('Loose units must be a decimal'),
    body('document_number').optional().isString().withMessage('Document number must be a string'),
    validate
  ],
  inventoryController.adjustInventory
);

module.exports = router;
