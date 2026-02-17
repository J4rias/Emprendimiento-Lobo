const express = require('express');
const router = express.Router();
const creditNoteController = require('../controllers/creditNote.controller');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

/**
 * @route   GET /api/credit-notes/stats
 * @desc    Get credit note statistics
 * @access  Private (requires credit_notes.view permission)
 */
router.get(
  '/stats',
  authenticate,
  authorize('credit_notes.view'),
  creditNoteController.getCreditNoteStats
);

/**
 * @route   GET /api/credit-notes
 * @desc    Get all credit notes with filters
 * @access  Private (requires credit_notes.view permission)
 */
router.get(
  '/',
  authenticate,
  authorize('credit_notes.view'),
  creditNoteController.getAllCreditNotes
);

/**
 * @route   GET /api/credit-notes/:id
 * @desc    Get credit note by ID
 * @access  Private (requires credit_notes.view permission)
 */
router.get(
  '/:id',
  authenticate,
  authorize('credit_notes.view'),
  creditNoteController.getCreditNoteById
);

/**
 * @route   POST /api/credit-notes
 * @desc    Create a new credit note
 * @access  Private (requires credit_notes.create permission)
 */
router.post(
  '/',
  authenticate,
  authorize('credit_notes.create'),
  creditNoteController.createCreditNote
);

/**
 * @route   POST /api/credit-notes/:id/approve
 * @desc    Approve and apply a credit note
 * @access  Private (requires credit_notes.approve permission)
 */
router.post(
  '/:id/approve',
  authenticate,
  authorize('credit_notes.approve'),
  creditNoteController.approveCreditNote
);

/**
 * @route   POST /api/credit-notes/:id/cancel
 * @desc    Cancel a credit note
 * @access  Private (requires credit_notes.delete permission)
 */
router.post(
  '/:id/cancel',
  authenticate,
  authorize('credit_notes.delete'),
  creditNoteController.cancelCreditNote
);

module.exports = router;
