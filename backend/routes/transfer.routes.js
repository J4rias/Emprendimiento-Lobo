const express = require('express');
const { body, param } = require('express-validator');
const transferController = require('../controllers/transfer.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = express.Router();

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
  [
    body('origin_warehouse_id').isInt(),
    body('destination_warehouse_id').isInt(),
    body('items').isArray({ min: 1 }),
    body('items.*.product_id').isInt(),
    body('items.*.presentation_id').optional({ nullable: true }).isInt(),
    body('items.*.package_quantity').optional({ nullable: true }).isInt(),
    body('items.*.loose_units').optional({ nullable: true }).isInt(),
    body('items.*.batch_id').optional({ nullable: true }).isInt(),
    validate
  ],
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
  param('id').isInt(),
  validate,
  transferController.cancelTransfer
);

module.exports = router;
