const express = require('express');
const router = express.Router();
const company = require('../controllers/company.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// Público — carga el nombre de empresa antes del login
router.get('/', company.getSettings);

// Protegido — solo Admin/quienes tengan settings.manage
router.put('/', auth, authorize('settings.manage'), company.updateSettings);

module.exports = router;
