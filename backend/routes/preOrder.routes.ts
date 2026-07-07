import { Router } from 'express';
import validateZod from '../middleware/validateZod';
import { CreatePreOrderSchema, ConvertPreOrderSchema } from '../schemas/preOrder.schema';
const preOrderController = require('../controllers/preOrder.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();

router.post('/',
  auth,
  authorize('pre_orders.create'),
  validateZod(CreatePreOrderSchema),
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
  validateZod(ConvertPreOrderSchema),
  preOrderController.convert
);

export = router;
