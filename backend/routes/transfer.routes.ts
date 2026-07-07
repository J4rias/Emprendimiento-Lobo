import { Router } from 'express';
import validateZod from '../middleware/validateZod';
import { CreateTransferSchema, CancelTransferSchema } from '../schemas/transfer.schema';
const { param } = require('express-validator');
const transferController = require('../controllers/transfer.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = Router();

router.use(auth);

router.get('/',
  authorize('inventory.transfer'),
  transferController.getTransfers
);

router.get('/:id',
  authorize('inventory.transfer'),
  param('id').isInt(),
  validate,
  transferController.getTransferById
);

router.post('/',
  authorize('inventory.transfer'),
  validateZod(CreateTransferSchema),
  transferController.createTransfer
);

router.post('/:id/receive',
  authorize('inventory.receive'),
  param('id').isInt(),
  validate,
  transferController.receiveTransfer
);

router.post('/:id/cancel',
  authorize('inventory.transfer'),
  validateZod(CancelTransferSchema),
  transferController.cancelTransfer
);

export = router;
