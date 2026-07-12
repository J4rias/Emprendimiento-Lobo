import { Router } from 'express';
const userController = require('../controllers/user.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

import validateZod from '../middleware/validateZod';
import { CreateUserSchema, UpdateUserSchema } from '../schemas/user.schema';

const router = Router();

// Aplicar autenticación a todas las rutas
router.use(auth);

// Rutas de usuarios
router.get('/', authorize('users.view'), userController.getAllUsers);
router.get('/:id', authorize('users.view'), userController.getUserById);
router.post('/', authorize('users.create'), validateZod(CreateUserSchema), userController.createUser);
router.put('/:id', authorize('users.update'), validateZod(UpdateUserSchema), userController.updateUser);
router.delete('/:id', authorize('users.delete'), userController.deleteUser);

export = router;
