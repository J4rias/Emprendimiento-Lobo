const express = require('express');
const router = express.Router();
const arController = require('../controllers/ar.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// ─── Resumen y listados ───────────────────────────────────────────────────────
router.get('/summary',   authenticate, authorize('ar.view'), arController.getSummary);
router.get('/customers', authenticate, authorize('ar.view'), arController.getCustomers);

// ─── Statement de cliente ─────────────────────────────────────────────────────
router.get('/customers/:id/statement', authenticate, authorize('ar.view'), arController.getCustomerStatement);

// ─── Exportar CSV ─────────────────────────────────────────────────────────────
router.get('/export/invoices',  authenticate, authorize('ar.view'), arController.exportInvoicesCSV);
router.get('/export/customers', authenticate, authorize('ar.view'), arController.exportCustomersCSV);

// ─── Reversión de abonos ──────────────────────────────────────────────────────
router.post('/payments/:paymentId/reverse', authenticate, authorize('ar.view'), arController.reversePayment);

// ─── PIN de admin ─────────────────────────────────────────────────────────────
router.get('/admin-pin/status',    authenticate, arController.getAdminPinStatus);
router.post('/admin-pin/validate', authenticate, arController.validateAdminPin);
router.put('/admin-pin',           authenticate, arController.setAdminPin);

module.exports = router;
