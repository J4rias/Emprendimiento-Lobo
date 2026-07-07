import { Router } from 'express';
import validateZod from '../middleware/validateZod';
import { CreateCategorySchema, UpdateCategorySchema } from '../schemas/category.schema';
const categoryController = require('../controllers/category.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();

// All routes require authentication
router.use(auth);

// Get all categories with pagination
router.get('/', categoryController.getAll);

// Get category by ID
router.get('/:id', categoryController.getById);

// Create category
router.post('/',
  authorize('products.create'),
  validateZod(CreateCategorySchema),
  categoryController.create
);

// Update category
router.put('/:id',
  authorize('products.create'),
  validateZod(UpdateCategorySchema),
  categoryController.update
);

// Delete category
router.delete('/:id',
  authorize('products.create'),
  categoryController.delete
);

export = router;
