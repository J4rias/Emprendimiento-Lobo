const express = require('express');
const { body } = require('express-validator');
const categoryController = require('../controllers/category.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const logger = require('../config/logger');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get all categories with pagination
router.get('/', categoryController.getAll);

// Get categories with product count
// DEPRECATED: use GET /api/categories?include=product_count instead
router.get('/with-count', (req, res, next) => {
  logger.warn('[DEPRECATED] GET /api/categories/with-count — use GET /api/categories?include=product_count');
  next();
}, categoryController.getWithProductCount);

// Get category by ID
router.get('/:id', categoryController.getById);

// Create category
router.post('/',
  authorize('products.create'),
  [
    body('code')
      .trim()
      .notEmpty()
      .withMessage('El código de la categoría es requerido')
      .isLength({ max: 10 })
      .withMessage('El código no puede exceder 10 caracteres'),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('El nombre de la categoría es requerido')
      .isLength({ max: 100 })
      .withMessage('El nombre no puede exceder 100 caracteres'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('La descripción no puede exceder 255 caracteres'),
    body('color')
      .optional()
      .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .withMessage('El color debe ser un código hexadecimal válido')
  ],
  validate,
  categoryController.create
);

// Update category
router.put('/:id',
  authorize('products.create'),
  [
    body('code')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('El código de la categoría no puede estar vacío')
      .isLength({ max: 10 }),
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('El nombre de la categoría no puede estar vacío')
      .isLength({ max: 100 })
      .withMessage('El nombre no puede exceder 100 caracteres'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('La descripción no puede exceder 255 caracteres'),
    body('color')
      .optional()
      .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .withMessage('El color debe ser un código hexadecimal válido')
  ],
  validate,
  categoryController.update
);

// Delete category
router.delete('/:id',
  authorize('products.create'),
  categoryController.delete
);

module.exports = router;
