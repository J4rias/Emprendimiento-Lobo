const express = require('express');
const { body } = require('express-validator');
const productController = require('../controllers/product.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get all products
router.get('/', productController.getAll);

// Get product by ID
router.get('/:id', productController.getById);

// Search by barcode
router.get('/barcode/:barcode', productController.searchByBarcode);

// Create product
router.post('/',
  authorize('products.create'),
  [
    body('name').notEmpty().withMessage('Product name is required'),
    body('category_id').isInt().withMessage('Category ID must be an integer'),
    body('unit_of_measure').notEmpty().withMessage('Unit of measure is required'),
    body('tax_rate').optional().isDecimal().withMessage('Tax rate must be a decimal'),
    body('min_stock').optional().isDecimal().withMessage('Min stock must be a decimal'),
    body('max_stock').optional().isDecimal().withMessage('Max stock must be a decimal'),
    body('reorder_point').optional().isDecimal().withMessage('Reorder point must be a decimal'),
    validate
  ],
  productController.create
);

// Update product
router.put('/:id',
  authorize('products.update'),
  [
    body('name').optional().notEmpty().withMessage('Product name cannot be empty'),
    body('category_id').optional().isInt().withMessage('Category ID must be an integer'),
    body('unit_of_measure').optional().notEmpty().withMessage('Unit of measure cannot be empty'),
    validate
  ],
  productController.update
);

// Delete product
router.delete('/:id',
  authorize('products.delete'),
  productController.delete
);

module.exports = router;
