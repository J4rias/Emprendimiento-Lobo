import { Router } from 'express';
import validateZod from '../middleware/validateZod';
import { CreateCompanySchema, UpdateCompanySchema } from '../schemas/company.schema';
const company = require('../controllers/company.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();

// Público — carga el nombre de empresa antes del login
router.get('/', company.getSettings);

// Protegido — solo Admin/quienes tengan settings.manage
router.put('/', auth, authorize('settings.manage'), validateZod(UpdateCompanySchema), company.updateSettings);

export = router;
