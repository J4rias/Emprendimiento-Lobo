import { Router } from 'express';
const catalogController = require('../controllers/catalog.controller');

const router = Router();

// Public endpoint — no auth required
router.get('/', catalogController.getCatalog);

export = router;
