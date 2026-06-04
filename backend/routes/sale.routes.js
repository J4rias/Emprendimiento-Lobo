const express = require('express');
const router = express.Router();
const saleController = require('../controllers/sale.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.post('/validate-credit-pin',
  auth,
  authorize('sales.create'),
  saleController.validateCreditPin
);

router.post('/',
  auth,
  authorize('sales.create'),
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

router.get('/product-sales',
  auth,
  authorize('sales.view'),
  saleController.getProductSales
);

router.get('/by-number/:saleNumber',
  auth,
  authorize('sales.view'),
  saleController.getSaleBySaleNumber
);

router.get('/:id',
  auth,
  authorize('sales.view'),
  saleController.getSaleById
);

router.put('/:id',
  auth,
  authorize('sales.update'),
  saleController.updateSale
);

router.post('/:id/cancel',
  auth,
  authorize('sales.cancel'),
  saleController.cancelSale
);

router.post('/:id/payments',
  auth,
  authorize('sales.create'),
  saleController.addPayment
);

module.exports = router;
