const express = require('express');
const router = express.Router();
const posReservationController = require('../controllers/posReservation.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// All POS endpoints require authentication
// POST /api/pos/reserve - Reserve or update a product reservation
router.post(
  '/reserve',
  authenticate,
  authorize('sales.create'),
  posReservationController.reserve
);

// PATCH /api/pos/reserve - Release/reduce a product reservation
router.patch(
  '/reserve',
  authenticate,
  authorize('sales.create'),
  posReservationController.releaseItem
);

// DELETE /api/pos/tab - Release all reservations for a tab
router.delete(
  '/tab',
  authenticate,
  authorize('sales.create'),
  posReservationController.releaseTab
);

// GET /api/pos/reservations - Get all current reservations (for client initialization)
router.get(
  '/reservations',
  authenticate,
  authorize('sales.create'),
  posReservationController.getAll
);

// POST /api/pos/cleanup-expired - Clean up expired reservations (admin/cron)
router.post(
  '/cleanup-expired',
  authenticate,
  authorize('admin'),
  posReservationController.cleanupExpired
);

module.exports = router;
