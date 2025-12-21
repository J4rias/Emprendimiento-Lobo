const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quote.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// Todas las rutas requieren autenticación
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
  quoteController.updateQuote
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

module.exports = router;
