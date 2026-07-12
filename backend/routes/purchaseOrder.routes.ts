import { Router } from 'express';
import validateZod from '../middleware/validateZod';
import {
  CreatePurchaseOrderSchema,
  UpdatePurchaseOrderSchema,
  CancelPurchaseOrderSchema,
  ReceiveMerchandiseSchema,
} from '../schemas/purchaseOrder.schema';
const purchaseOrderController = require('../controllers/purchaseOrder.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();

// Get all purchase orders with filters
router.get(
  '/',
  authenticate,
  authorize('purchases.view'),
  purchaseOrderController.getAllPurchaseOrders
);

// Get purchase order statistics
router.get(
  '/stats',
  authenticate,
  authorize('purchases.view'),
  purchaseOrderController.getPurchaseOrderStats
);

// Get purchase order by ID
router.get(
  '/:id',
  authenticate,
  authorize('purchases.view'),
  purchaseOrderController.getPurchaseOrderById
);

// Create purchase order
router.post(
  '/',
  authenticate,
  authorize('purchases.create'),
  validateZod(CreatePurchaseOrderSchema),
  purchaseOrderController.createPurchaseOrder
);

// Update purchase order (only draft)
router.put(
  '/:id',
  authenticate,
  authorize('purchases.update'),
  validateZod(UpdatePurchaseOrderSchema),
  purchaseOrderController.updatePurchaseOrder
);

// Approve purchase order
router.post(
  '/:id/approve',
  authenticate,
  authorize('purchases.approve'),
  purchaseOrderController.approvePurchaseOrder
);

// Cancel purchase order
router.post(
  '/:id/cancel',
  authenticate,
  authorize('purchases.delete'),
  validateZod(CancelPurchaseOrderSchema),
  purchaseOrderController.cancelPurchaseOrder
);

// Receive merchandise
router.post(
  '/:id/receive',
  authenticate,
  authorize('purchases.receive'),
  validateZod(ReceiveMerchandiseSchema),
  purchaseOrderController.receiveMerchandise
);

export = router;
