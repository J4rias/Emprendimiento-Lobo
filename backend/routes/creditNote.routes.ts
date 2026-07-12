import { Router } from 'express';
import validateZod from '../middleware/validateZod';
import { CreateCreditNoteSchema, CancelCreditNoteSchema } from '../schemas/creditNote.schema';
const creditNoteController = require('../controllers/creditNote.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = Router();

router.get('/stats', authenticate, authorize('credit_notes.view'), creditNoteController.getCreditNoteStats);
router.get('/', authenticate, authorize('credit_notes.view'), creditNoteController.getAllCreditNotes);
router.get('/:id', authenticate, authorize('credit_notes.view'), creditNoteController.getCreditNoteById);

router.post('/', authenticate, authorize('credit_notes.create'), validateZod(CreateCreditNoteSchema), creditNoteController.createCreditNote);
router.post('/:id/approve', authenticate, authorize('credit_notes.approve'), creditNoteController.approveCreditNote);
router.post('/:id/cancel', authenticate, authorize('credit_notes.delete'), validateZod(CancelCreditNoteSchema), creditNoteController.cancelCreditNote);

export = router;
