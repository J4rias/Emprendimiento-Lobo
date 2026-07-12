import { Router } from 'express';
const brandController = require('../controllers/brand.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
import validateZod from '../middleware/validateZod';
import { CreateBrandSchema, UpdateBrandSchema } from '../schemas/brand.schema';

const router = Router();

// All routes require authentication
router.use(auth);

// Get all brands with pagination and search
router.get('/', authorize('brands.view'), brandController.getAll);

// Get brand by ID
router.get('/:id', authorize('brands.view'), brandController.getById);

// Create new brand
router.post('/', authorize('brands.create'), validateZod(CreateBrandSchema), brandController.create);

// Update brand
router.put('/:id', authorize('brands.update'), validateZod(UpdateBrandSchema), brandController.update);

// Delete brand (soft delete)
router.delete('/:id', authorize('brands.delete'), brandController.deleteBrand);

export = router;
