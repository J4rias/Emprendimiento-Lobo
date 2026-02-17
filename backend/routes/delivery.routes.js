const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/delivery.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

/**
 * @route   GET /api/deliveries/stats
 * @desc    Get delivery statistics
 * @access  Private (requires deliveries.view permission)
 */
router.get(
  '/stats',
  authenticate,
  authorize('deliveries.view'),
  deliveryController.getDeliveryStats
);

/**
 * @route   GET /api/deliveries
 * @desc    Get all deliveries with filters
 * @access  Private (requires deliveries.view permission)
 */
router.get(
  '/',
  authenticate,
  authorize('deliveries.view'),
  deliveryController.getAllDeliveries
);

/**
 * @route   GET /api/deliveries/:id
 * @desc    Get delivery by ID
 * @access  Private (requires deliveries.view permission)
 */
router.get(
  '/:id',
  authenticate,
  authorize('deliveries.view'),
  deliveryController.getDeliveryById
);

/**
 * @route   POST /api/deliveries
 * @desc    Create a new delivery from a sale
 * @access  Private (requires deliveries.create permission)
 */
router.post(
  '/',
  authenticate,
  authorize('deliveries.create'),
  deliveryController.createDelivery
);

/**
 * @route   PUT /api/deliveries/:id
 * @desc    Update delivery information
 * @access  Private (requires deliveries.update permission)
 */
router.put(
  '/:id',
  authenticate,
  authorize('deliveries.update'),
  deliveryController.updateDelivery
);

/**
 * @route   POST /api/deliveries/:id/in-transit
 * @desc    Mark delivery as in transit
 * @access  Private (requires deliveries.update permission)
 */
router.post(
  '/:id/in-transit',
  authenticate,
  authorize('deliveries.update'),
  deliveryController.markAsInTransit
);

/**
 * @route   POST /api/deliveries/:id/confirm
 * @desc    Confirm delivery as delivered
 * @access  Private (requires deliveries.update permission)
 */
router.post(
  '/:id/confirm',
  authenticate,
  authorize('deliveries.update'),
  deliveryController.confirmDelivery
);

/**
 * @route   POST /api/deliveries/:id/cancel
 * @desc    Cancel a delivery
 * @access  Private (requires deliveries.delete permission)
 */
router.post(
  '/:id/cancel',
  authenticate,
  authorize('deliveries.delete'),
  deliveryController.cancelDelivery
);

module.exports = router;
