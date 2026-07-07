import { Router } from 'express';
import validateZod from '../middleware/validateZod';
import { CreateProductSchema, UpdateProductSchema, CreatePresentationSchema, UpdatePresentationSchema } from '../schemas/product.schema';
const productController = require('../controllers/product.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { uploadSingle } = require('../middleware/upload');

const router = Router();

// All routes require authentication
router.use(auth);

// Get all products
router.get('/', productController.getAll);

// Get product by ID
router.get('/:id', productController.getById);

// Create product
router.post('/',
  authorize('products.create'),
  ...uploadSingle('image'),
  validateZod(CreateProductSchema),
  productController.create
);

// Update product
router.put('/:id',
  authorize('products.update'),
  ...uploadSingle('image'),
  validateZod(UpdateProductSchema),
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
  validateZod(CreatePresentationSchema),
  productController.createPresentation
);

router.put('/presentations/:presentationId',
  authorize('products.update'),
  validateZod(UpdatePresentationSchema),
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

export = router;
