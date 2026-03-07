const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// Get all customers with filters
router.get(
  '/',
  authenticate,
  authorize('customers.view'),
  customerController.getAllCustomers
);

// Get active customers (for dropdowns)
router.get(
  '/active',
  authenticate,
  authorize('customers.view'),
  customerController.getActiveCustomers
);

// Get customers with overdue credit balances (cuentas por cobrar vencidas)
router.get(
  '/overdue',
  authenticate,
  authorize('customers.view'),
  customerController.getOverdueCustomers
);

// Get customer by ID
router.get(
  '/:id',
  authenticate,
  authorize('customers.view'),
  customerController.getCustomerById
);

// Get customer credit summary
router.get(
  '/:id/credit',
  authenticate,
  authorize('customers.view'),
  customerController.getCreditSummary
);

// Validate credit availability
router.get(
  '/:id/credit/validate',
  authenticate,
  authorize('customers.view'),
  customerController.validateCredit
);

// Get customer statistics
router.get(
  '/:id/stats',
  authenticate,
  authorize('customers.view'),
  customerController.getCustomerStats
);

// Get customer statement (ledger)
router.get(
  '/:id/statement',
  authenticate,
  authorize('customers.view'),
  customerController.getStatement
);

// Create customer
router.post(
  '/',
  authenticate,
  authorize('customers.create'),
  customerController.createCustomer
);

// Update customer
router.put(
  '/:id',
  authenticate,
  authorize('customers.update'),
  customerController.updateCustomer
);

// Delete customer
router.delete(
  '/:id',
  authenticate,
  authorize('customers.delete'),
  customerController.deleteCustomer
);

module.exports = router;
