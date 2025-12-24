const express = require('express');
const { body } = require('express-validator');
const exchangeRateController = require('../controllers/exchangeRate.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get all exchange rates
router.get('/', exchangeRateController.getAll);

// Get latest exchange rates
router.get('/latest', exchangeRateController.getLatest);

// Convert amount
router.get('/convert', exchangeRateController.convert);

// Get exchange rate by ID
router.get('/:id', exchangeRateController.getById);

// Create exchange rate
router.post('/',
  authorize('settings.manage'),
  [
    body('from_currency').isIn(['USD', 'COP', 'VES']).withMessage('Invalid from_currency'),
    body('to_currency').isIn(['USD', 'COP', 'VES']).withMessage('Invalid to_currency'),
    body('rate').isFloat({ min: 0 }).withMessage('Rate must be a positive number'),
    body('effective_date').isDate().withMessage('Invalid effective_date'),
    validate
  ],
  exchangeRateController.create
);

// Update exchange rate
router.put('/:id',
  authorize('settings.manage'),
  [
    body('from_currency').optional().isIn(['USD', 'COP', 'VES']).withMessage('Invalid from_currency'),
    body('to_currency').optional().isIn(['USD', 'COP', 'VES']).withMessage('Invalid to_currency'),
    body('rate').optional().isFloat({ min: 0 }).withMessage('Rate must be a positive number'),
    body('effective_date').optional().isDate().withMessage('Invalid effective_date'),
    validate
  ],
  exchangeRateController.update
);

// Delete exchange rate
router.delete('/:id',
  authorize('settings.manage'),
  exchangeRateController.delete
);

module.exports = router;
