import { Router } from 'express';
const customerController = require('../controllers/customer.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');
import validateZod from '../middleware/validateZod';
import { CreateCustomerSchema, UpdateCustomerSchema } from '../schemas/customer.schema';

const router = Router();

// Get all customers with filters
router.get(
  '/',
  authenticate,
  authorize('customers.view'),
  customerController.getAllCustomers
);

// Get customer activity summary (must be before /:id)
router.get(
  '/activity',
  authenticate,
  authorize('customers.view'),
  customerController.getCustomerActivity
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

// Get customer purchase history
router.get(
  '/:id/purchases',
  authenticate,
  authorize('customers.view'),
  customerController.getCustomerPurchases
);

// Get customer credit balance (saldo a favor / overpayment)
router.get(
  '/:id/credit-balance',
  authenticate,
  authorize('customers.view'),
  customerController.getCreditBalance
);

// Create customer
router.post(
  '/',
  authenticate,
  authorize('customers.create'),
  validateZod(CreateCustomerSchema),
  customerController.createCustomer
);

// Update customer
router.put(
  '/:id',
  authenticate,
  authorize('customers.update'),
  validateZod(UpdateCustomerSchema),
  customerController.updateCustomer
);

// Delete customer
router.delete(
  '/:id',
  authenticate,
  authorize('customers.delete'),
  customerController.deleteCustomer
);

export = router;
