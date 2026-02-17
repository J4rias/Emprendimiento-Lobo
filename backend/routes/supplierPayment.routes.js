const express = require('express');
const router = express.Router();
const supplierPaymentController = require('../controllers/supplierPayment.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

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

module.exports = router;
