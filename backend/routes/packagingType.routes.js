const express = require('express');
const router = express.Router();
const packagingTypeController = require('../controllers/packagingType.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// All routes require authentication
router.use(auth);

// Get active packaging types for dropdowns
router.get('/active', authorize('products.view'), packagingTypeController.getActive);

module.exports = router;
