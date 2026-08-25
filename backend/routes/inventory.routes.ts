import { Router } from 'express';
import validateZod from '../middleware/validateZod';
import { CreateInventorySchema, UpdateInventorySchema } from '../schemas/inventory.schema';
const inventoryController = require('../controllers/inventory.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();

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

// Get inventory valuation — costos/valorización, a diferencia de cantidades/stock
// (esas quedan sin authorize a propósito, ver feedback_warehouse / permission_asymmetries:
// el Cajero no tiene inventory.view y necesita consultar existencias igual)
router.get('/valuation', authorize('inventory.view'), inventoryController.getValuation);

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
  validateZod(CreateInventorySchema),
  inventoryController.adjustInventory
);

export = router;
