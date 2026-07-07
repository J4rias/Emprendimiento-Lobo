import { Router } from 'express';
import validateZod from '../middleware/validateZod';
import { CreateExchangeRateSchema, UpdateExchangeRateSchema } from '../schemas/exchangeRate.schema';

const { body } = require('express-validator');
const exchangeRateController = require('../controllers/exchangeRate.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = Router();

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
  validateZod(CreateExchangeRateSchema),
  exchangeRateController.create
);

// Update exchange rate
router.put('/:id',
  authorize('settings.manage'),
  validateZod(UpdateExchangeRateSchema),
  exchangeRateController.update
);

// Delete exchange rate
router.delete('/:id',
  authorize('settings.manage'),
  exchangeRateController.delete
);

export = router;
