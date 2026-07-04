const express = require('express');
const { body } = require('express-validator');
const productController = require('../controllers/product.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { uploadSingle } = require('../middleware/upload');
const logger = require('../config/logger');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get all products
router.get('/', productController.getAll);

// Export products to CSV
// DEPRECATED: use GET /api/products?format=csv instead
router.get('/export-csv', (req, res, next) => {
  logger.warn('[DEPRECATED] GET /api/products/export-csv — use GET /api/products?format=csv');
  next();
}, productController.exportCSV);

// Search by barcode
// DEPRECATED: use GET /api/products?barcode=X instead
router.get('/barcode/:barcode', (req, res, next) => {
  logger.warn('[DEPRECATED] GET /api/products/barcode/:barcode — use GET /api/products?barcode=X');
  next();
}, productController.searchByBarcode);

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

// Presentation management routes
router.get('/:id/presentations',
  productController.getPresentations
);

router.post('/:id/presentations',
  authorize('products.update'),
  [
    body('name').notEmpty().withMessage('Presentation name is required'),
    body('units_per_package').isInt({ min: 1 }).withMessage('Units per package must be at least 1'),
    body('packaging_type_id').optional().isInt().withMessage('Packaging type ID must be an integer'),
    body('presentation_type_id').optional().isInt().withMessage('Presentation type ID must be an integer'),
    body('package_price').optional().isDecimal().withMessage('Package price must be a decimal'),
    body('package_cost').optional().isDecimal().withMessage('Package cost must be a decimal'),
    body('is_default').optional().isBoolean().withMessage('Is default must be a boolean'),
    body('is_active').optional().isBoolean().withMessage('Is active must be a boolean'),
    validate
  ],
  productController.createPresentation
);

router.put('/presentations/:presentationId',
  authorize('products.update'),
  [
    body('name').optional().notEmpty().withMessage('Presentation name cannot be empty'),
    body('units_per_package').optional().isInt({ min: 1 }).withMessage('Units per package must be at least 1'),
    body('packaging_type_id').optional().isInt().withMessage('Packaging type ID must be an integer'),
    body('presentation_type_id').optional().isInt().withMessage('Presentation type ID must be an integer'),
    body('package_price').optional().isDecimal().withMessage('Package price must be a decimal'),
    body('package_cost').optional().isDecimal().withMessage('Package cost must be a decimal'),
    body('is_active').optional().isBoolean().withMessage('Is active must be a boolean'),
    validate
  ],
  productController.updatePresentation
);

router.delete('/presentations/:presentationId',
  authorize('products.delete'),
  productController.deletePresentation
);

router.put('/presentations/:presentationId/set-default',
  authorize('products.update'),
  productController.setDefaultPresentation
);

module.exports = router;
