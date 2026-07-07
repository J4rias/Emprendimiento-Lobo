import { Router } from 'express';
import validateZod from '../middleware/validateZod';
import { LoginSchema, ChangePasswordSchema } from '../schemas/auth.schema';

const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth');

const router = Router();

// Login
router.post('/login', validateZod(LoginSchema), authController.login);

// Get current user
router.get('/me', auth, authController.me);

// Change password
router.post('/change-password', auth, validateZod(ChangePasswordSchema), authController.changePassword);

// Logout
router.post('/logout', auth, authController.logout);

export = router;
