import { Router } from 'express';
const presentationTypeController = require('../controllers/presentationType.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
import validateZod from '../middleware/validateZod';
import { CreatePresentationTypeSchema, UpdatePresentationTypeSchema } from '../schemas/presentationType.schema';

const router = Router();
router.use(auth);

router.get('/', authorize('products.view'), presentationTypeController.getAll);
router.get('/active', authorize('products.view'), presentationTypeController.getActive);
router.get('/:id', authorize('products.view'), presentationTypeController.getById);
router.post('/', authorize('products.create'), validateZod(CreatePresentationTypeSchema), presentationTypeController.create);
router.put('/:id', authorize('products.update'), validateZod(UpdatePresentationTypeSchema), presentationTypeController.update);
router.delete('/:id', authorize('products.update'), presentationTypeController.remove);

export = router;
