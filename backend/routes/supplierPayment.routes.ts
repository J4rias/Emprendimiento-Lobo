import { Router } from 'express';
import validateZod from '../middleware/validateZod';
import { CreateSupplierPaymentSchema, UpdateSupplierPaymentSchema, CancelPaymentSchema } from '../schemas/supplierPayment.schema';

const supplierPaymentController = require('../controllers/supplierPayment.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();

/**
 * @route   GET /api/supplier-payments/stats
 * @desc    Get payment statistics
 * @access  Private (requires payments.view permission)
 */
router.get(
  '/stats',
  authenticate,
  authorize('supplier_payments.view'),
  supplierPaymentController.getPaymentStats
);

/**
 * @route   GET /api/supplier-payments/supplier/:supplierId
 * @desc    Get payments by supplier
 * @access  Private (requires payments.view permission)
 */
router.get(
  '/supplier/:supplierId',
  authenticate,
  authorize('supplier_payments.view'),
  supplierPaymentController.getPaymentsBySupplier
);

/**
 * @route   GET /api/supplier-payments/payable-balance/:supplierId
 * @desc    Get total payable balance for a supplier (received POs minus payments)
 * @access  Private (requires payments.view permission)
 */
router.get(
  '/payable-balance/:supplierId',
  authenticate,
  authorize('supplier_payments.view'),
  supplierPaymentController.getPayableBalance
);

/**
 * @route   GET /api/supplier-payments/credit-balance/:supplierId
 * @desc    Get available credit balance (unallocated funds) for a supplier
 * @access  Private (requires payments.view permission)
 */
router.get(
  '/credit-balance/:supplierId',
  authenticate,
  authorize('supplier_payments.view'),
  supplierPaymentController.getSupplierCreditBalance
);

/**
 * @route   GET /api/supplier-payments/by-po/:poId
 * @desc    Get payments and balance summary for a specific purchase order
 * @access  Private (requires payments.view permission)
 */
router.get(
  '/by-po/:poId',
  authenticate,
  authorize('supplier_payments.view'),
  supplierPaymentController.getPaymentsByPO
);

/**
 * @route   POST /api/supplier-payments/:id/cancel
 * @desc    Cancel (anular) a supplier payment
 * @access  Private (requires payments.delete permission)
 */
router.post(
  '/:id/cancel',
  authenticate,
  authorize('supplier_payments.delete'),
  validateZod(CancelPaymentSchema),
  supplierPaymentController.cancelPayment
);

/**
 * @route   GET /api/supplier-payments
 * @desc    Get all supplier payments with filters
 * @access  Private (requires payments.view permission)
 */
router.get(
  '/',
  authenticate,
  authorize('supplier_payments.view'),
  supplierPaymentController.getAllPayments
);

/**
 * @route   GET /api/supplier-payments/:id
 * @desc    Get supplier payment by ID
 * @access  Private (requires payments.view permission)
 */
router.get(
  '/:id',
  authenticate,
  authorize('supplier_payments.view'),
  supplierPaymentController.getPaymentById
);

/**
 * @route   POST /api/supplier-payments
 * @desc    Create a new supplier payment
 * @access  Private (requires payments.create permission)
 */
router.post(
  '/',
  authenticate,
  authorize('supplier_payments.create'),
  validateZod(CreateSupplierPaymentSchema),
  supplierPaymentController.createPayment
);

/**
 * @route   PUT /api/supplier-payments/:id
 * @desc    Update a supplier payment
 * @access  Private (requires payments.update permission)
 */
router.put(
  '/:id',
  authenticate,
  authorize('supplier_payments.update'),
  validateZod(UpdateSupplierPaymentSchema),
  supplierPaymentController.updatePayment
);

/**
 * @route   DELETE /api/supplier-payments/:id
 * @desc    Delete a supplier payment
 * @access  Private (requires payments.delete permission)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('supplier_payments.delete'),
  supplierPaymentController.deletePayment
);

export = router;
