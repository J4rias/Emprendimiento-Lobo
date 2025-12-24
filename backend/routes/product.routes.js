const express = require('express');
const { body } = require('express-validator');
const productController = require('../controllers/product.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { uploadSingle } = require('../middleware/upload');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get all products
router.get('/', productController.getAll);

// Search by barcode
router.get('/barcode/:barcode', productController.searchByBarcode);

// Get product by ID
router.get('/:id', productController.getById);

// Create product
router.post('/',
  authorize('products.create'),
  ...uploadSingle('image'),
  [
    body('name').notEmpty().withMessage('Product name is required'),
    body('category_id').isInt().withMessage('Category ID must be an integer'),
    body('brand_id').optional().isInt().withMessage('Brand ID must be an integer'),
    body('min_stock').optional().isInt().withMessage('Min stock must be an integer'),
    body('max_stock').optional().isInt().withMessage('Max stock must be an integer'),
    body('reorder_point').optional().isInt().withMessage('Reorder point must be an integer'),
    validate
  ],
  productController.create
);

// Update product
router.put('/:id',
  authorize('products.update'),
  ...uploadSingle('image'),
  [
    body('name').optional().notEmpty().withMessage('Product name cannot be empty'),
    body('category_id').optional().isInt().withMessage('Category ID must be an integer'),
    body('brand_id').optional().isInt().withMessage('Brand ID must be an integer'),
    body('min_stock').optional().isInt().withMessage('Min stock must be an integer'),
    body('max_stock').optional().isInt().withMessage('Max stock must be an integer'),
    body('reorder_point').optional().isInt().withMessage('Reorder point must be an integer'),
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
