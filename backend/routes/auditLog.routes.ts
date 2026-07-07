import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditLog.controller';

const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();

router.use(auth);

router.get('/', authorize('settings.manage'), getAuditLogs);

export = router;
