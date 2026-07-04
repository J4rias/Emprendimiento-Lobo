const express = require('express');
const router = express.Router();
const preOrderController = require('../controllers/preOrder.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.post('/',
  auth,
  authorize('pre_orders.create'),
  preOrderController.create
);

router.get('/',
  auth,
  authorize('pre_orders.view'),
  preOrderController.getAll
);

router.get('/stats',
  auth,
  authorize('pre_orders.view'),
  preOrderController.getStats
);

router.get('/:id',
  auth,
  authorize('pre_orders.view'),
  preOrderController.getById
);

router.post('/:id/approve',
  auth,
  authorize('pre_orders.approve'),
  preOrderController.approve
);

router.post('/:id/reject',
  auth,
  authorize('pre_orders.approve'),
  preOrderController.reject
);

router.post('/:id/convert',
  auth,
  authorize('pre_orders.approve'),
  preOrderController.convert
);

module.exports = router;
