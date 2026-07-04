const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Bank } = require('../models');

// GET /api/banks — list active banks (optionally filter by currency)
router.get('/', auth, async (req, res) => {
  try {
    const where = { is_active: true };
    if (req.query.currency) where.currency = req.query.currency;

    const banks = await Bank.findAll({ where, order: [['name', 'ASC']] });
    res.json({ data: banks });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener bancos' });
  }
});

module.exports = router;
