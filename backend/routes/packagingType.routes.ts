import { Router } from 'express';
const packagingTypeController = require('../controllers/packagingType.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

import validateZod from '../middleware/validateZod';
import { CreatePackagingTypeSchema, UpdatePackagingTypeSchema } from '../schemas/packagingType.schema';

const router = Router();
router.use(auth);

router.get('/', authorize('products.view'), packagingTypeController.getAll);
router.get('/active', authorize('products.view'), packagingTypeController.getActive);
router.get('/:id', authorize('products.view'), packagingTypeController.getById);
router.post('/', authorize('products.create'), validateZod(CreatePackagingTypeSchema), packagingTypeController.create);
router.put('/:id', authorize('products.update'), validateZod(UpdatePackagingTypeSchema), packagingTypeController.update);
router.delete('/:id', authorize('products.update'), packagingTypeController.remove);

export = router;
