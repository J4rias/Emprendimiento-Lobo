import { Router } from 'express';
import validateZod from '../middleware/validateZod';
import { CreateSaleSchema, UpdateSaleSchema, ValidateCreditPinSchema, CancelSaleSchema, AddPaymentSchema } from '../schemas/sale.schema';
const saleController = require('../controllers/sale.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();

router.post('/validate-credit-pin',
  auth,
  authorize('sales.create'),
  validateZod(ValidateCreditPinSchema),
  saleController.validateCreditPin
);

router.post('/',
  auth,
  authorize('sales.create'),
  validateZod(CreateSaleSchema),
  saleController.createSale
);

router.get('/',
  auth,
  authorize('sales.view'),
  saleController.getSales
);

router.get('/stats',
  auth,
  authorize('sales.view'),
  saleController.getSalesStats
);

router.get('/daily-closure',
  auth,
  authorize('sales.view'),
  saleController.getDailyClosure
);

router.get('/summary',
  auth,
  authorize('sales.view'),
  saleController.getSalesSummary
);

router.get('/daily-series',
  auth,
  authorize('sales.view'),
  saleController.getDailySeries
);

router.get('/product-sales',
  auth,
  authorize('sales.view'),
  saleController.getProductSales
);

router.get('/payments-report',
  auth,
  authorize('sales.view'),
  saleController.getPaymentsReport
);

router.get('/commissions',
  auth,
  authorize('commissions.view'),
  saleController.getCommissions
);

router.get('/:id',
  auth,
  authorize('sales.view'),
  saleController.getSaleById
);

router.patch('/:id',
  auth,
  authorize('sales.update'),
  validateZod(UpdateSaleSchema),
  saleController.updateSale
);

router.post('/:id/cancel',
  auth,
  authorize('sales.cancel'),
  validateZod(CancelSaleSchema),
  saleController.cancelSale
);

router.post('/:id/payments',
  auth,
  authorize('sales.collect'),
  validateZod(AddPaymentSchema),
  saleController.addPayment
);

export = router;
