const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/catalog.controller');

// Public endpoint — no auth required
router.get('/', catalogController.getCatalog);

module.exports = router;
