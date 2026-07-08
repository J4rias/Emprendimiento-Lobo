import { Router } from 'express';
import validateZod from '../middleware/validateZod';
import { CreateQuoteSchema, UpdateQuoteSchema } from '../schemas/quote.schema';

const quoteController = require('../controllers/quote.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();
router.use(auth);

/**
 * @route   GET /api/quotes
 * @desc    Obtener todas las cotizaciones con filtros y paginación
 * @access  Private (sales.quotes.view)
 */
router.get(
  '/',
  authorize('sales.quotes.view'),
  quoteController.getAllQuotes
);

/**
 * @route   GET /api/quotes/stats
 * @desc    Obtener estadísticas de cotizaciones
 * @access  Private (sales.quotes.view)
 */
router.get(
  '/stats',
  authorize('sales.quotes.view'),
  quoteController.getQuoteStats
);

/**
 * @route   GET /api/quotes/:id
 * @desc    Obtener una cotización por ID
 * @access  Private (sales.quotes.view)
 */
router.get(
  '/:id',
  authorize('sales.quotes.view'),
  quoteController.getQuoteById
);

/**
 * @route   POST /api/quotes
 * @desc    Crear una nueva cotización
 * @access  Private (sales.quotes.create)
 */
router.post(
  '/',
  authorize('sales.quotes.create'),
  validateZod(CreateQuoteSchema),
  quoteController.createQuote
);

/**
 * @route   PUT /api/quotes/:id
 * @desc    Actualizar una cotización
 * @access  Private (sales.quotes.update)
 */
router.put(
  '/:id',
  authorize('sales.quotes.update'),
  validateZod(UpdateQuoteSchema),
  quoteController.updateQuote
);

/**
 * @route   PATCH /api/quotes/:id/status
 * @desc    Cambiar estado de una cotización (approve, reject, sent)
 * @access  Private (sales.quotes.update)
 */
router.patch(
  '/:id/status',
  authorize('sales.quotes.update'),
  quoteController.updateQuoteStatus
);

/**
 * @route   POST /api/quotes/:id/convert
 * @desc    Convertir cotización aprobada a venta a crédito
 * @access  Private (sales.quotes.update)
 */
router.post(
  '/:id/convert',
  authorize('sales.quotes.update'),
  quoteController.convertQuote
);

/**
 * @route   DELETE /api/quotes/:id
 * @desc    Eliminar una cotización (soft delete)
 * @access  Private (sales.quotes.delete)
 */
router.delete(
  '/:id',
  authorize('sales.quotes.delete'),
  quoteController.deleteQuote
);

export = router;
