import { Router } from 'express';
import validateZod from '../middleware/validateZod';
import { ReversePaymentSchema, ValidateAdminPinSchema, UpdateArSchema } from '../schemas/ar.schema';
const arController = require('../controllers/ar.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();

// ─── Resumen y listados ───────────────────────────────────────────────────────
router.get('/summary',   authenticate, authorize('ar.view'), arController.getSummary);
router.get('/customers', authenticate, authorize('ar.view'), arController.getCustomers);

// ─── Statement de cliente ─────────────────────────────────────────────────────
router.get('/customers/:id/statement', authenticate, authorize('ar.view'), arController.getCustomerStatement);

// ─── Exportar CSV ─────────────────────────────────────────────────────────────
router.get('/export/invoices',  authenticate, authorize('ar.view'), arController.exportInvoicesCSV);
router.get('/export/customers', authenticate, authorize('ar.view'), arController.exportCustomersCSV);

// ─── Reversión de abonos ──────────────────────────────────────────────────────
router.post('/payments/:paymentId/reverse', authenticate, authorize('ar.view'), validateZod(ReversePaymentSchema), arController.reversePayment);

// ─── PIN de admin ─────────────────────────────────────────────────────────────
router.get('/admin-pin/status',    authenticate, authorize('ar.view'), arController.getAdminPinStatus);
router.post('/admin-pin/validate', authenticate, authorize('ar.view'), validateZod(ValidateAdminPinSchema), arController.validateAdminPin);
router.put('/admin-pin',           authenticate, authorize('ar.view'), validateZod(UpdateArSchema), arController.setAdminPin);

export = router;
