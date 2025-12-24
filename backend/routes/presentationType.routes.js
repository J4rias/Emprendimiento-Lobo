const express = require('express');
const router = express.Router();
const presentationTypeController = require('../controllers/presentationType.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// All routes require authentication
router.use(auth);

// Get active presentation types for dropdowns
router.get('/active', authorize('products.view'), presentationTypeController.getActive);

module.exports = router;
