const express = require('express');
const { body } = require('express-validator');
const inventoryController = require('../controllers/inventory.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get inventory by warehouse
router.get('/warehouse/:warehouse_id', inventoryController.getByWarehouse);

// Get inventory by product
router.get('/product/:product_id', inventoryController.getByProduct);

// Get low stock products
router.get('/alerts/low-stock', inventoryController.getLowStock);

// Get expiring products
router.get('/alerts/expiring', inventoryController.getExpiringProducts);

// Get inventory valuation
router.get('/valuation', inventoryController.getValuation);

// Adjust inventory
router.post('/adjust',
  authorize('inventory.adjust'),
  [
    body('product_id').isInt().withMessage('Product ID must be an integer'),
    body('warehouse_id').isInt().withMessage('Warehouse ID must be an integer'),
    body('quantity').isDecimal().withMessage('Quantity must be a decimal'),
    body('type').isIn(['add', 'remove']).withMessage('Type must be "add" or "remove"'),
    body('reason').notEmpty().withMessage('Reason is required'),
    validate
  ],
  inventoryController.adjustInventory
);

module.exports = router;
