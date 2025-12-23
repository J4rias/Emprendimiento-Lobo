const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brand.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// All routes require authentication
router.use(auth);

// Get all brands with pagination and search
router.get('/', authorize('brands.view'), brandController.getAll);

// Get active brands for dropdowns
router.get('/active', authorize('brands.view'), brandController.getActive);

// Get brand by ID
router.get('/:id', authorize('brands.view'), brandController.getById);

// Create new brand
router.post('/', authorize('brands.create'), brandController.create);

// Update brand
router.put('/:id', authorize('brands.update'), brandController.update);

// Delete brand (soft delete)
router.delete('/:id', authorize('brands.delete'), brandController.deleteBrand);

module.exports = router;
