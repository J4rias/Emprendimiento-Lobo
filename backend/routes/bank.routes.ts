import { Router } from 'express';
import validateZod from '../middleware/validateZod';
import { CreateBankSchema, UpdateBankSchema } from '../schemas/bank.schema';

const router = Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { Bank } = require('../models');

router.use(auth);

// GET / — list banks (filter by currency, is_active)
router.get('/', async (req, res, next) => {
  try {
    const where: Record<string, any> = {};
    if (req.query.currency) where.currency = req.query.currency;
    if (req.query.is_active !== undefined) where.is_active = req.query.is_active === 'true';
    else where.is_active = true;

    const banks = await Bank.findAll({ where, order: [['name', 'ASC']] });
    res.json({ data: banks });
  } catch (error) {
    next(error);
  }
});

// GET /:id
router.get('/:id', async (req, res, next) => {
  try {
    const bank = await Bank.findByPk(req.params.id);
    if (!bank) return res.status(404).json({ message: 'Banco no encontrado' });
    res.json({ data: bank });
  } catch (error) {
    next(error);
  }
});

// POST / — create
router.post('/', authorize('admin'), validateZod(CreateBankSchema), async (req, res, next) => {
  try {
    const { name, currency, type } = req.body;
    const bank = await Bank.create({ name, currency, type });
    res.status(201).json({ data: bank });
  } catch (error) {
    next(error);
  }
});

// PUT /:id — update
router.put('/:id', authorize('admin'), validateZod(UpdateBankSchema), async (req, res, next) => {
  try {
    const bank = await Bank.findByPk(req.params.id);
    if (!bank) return res.status(404).json({ message: 'Banco no encontrado' });
    const { name, currency, type, is_active } = req.body;
    await bank.update({ name, currency, type, is_active });
    res.json({ data: bank });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id — soft delete
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const bank = await Bank.findByPk(req.params.id);
    if (!bank) return res.status(404).json({ message: 'Banco no encontrado' });
    await bank.update({ is_active: false });
    res.json({ message: 'Banco desactivado' });
  } catch (error) {
    next(error);
  }
});

export = router;
