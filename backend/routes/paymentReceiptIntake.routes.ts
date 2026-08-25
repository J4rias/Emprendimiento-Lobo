import { Router } from 'express';

const paymentReceiptIntakeController = require('../controllers/paymentReceiptIntake.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();

// auth acepta X-API-Key (bot) o JWT; authorize exige el permiso bot-only
router.use(auth);

router.post('/intake', authorize('payment_receipts.ingest'), paymentReceiptIntakeController.create);

export = router;
