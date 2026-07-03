const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// Login
router.post('/login',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate
  ],
  authController.login
);

// Get current user
router.get('/me', auth, authController.me);

// Change password
router.post('/change-password',
  auth,
  [
    body('current_password').notEmpty().withMessage('La contrasena actual es requerida'),
    body('new_password')
      .isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
      .notEmpty().withMessage('New password is required'),
    validate
  ],
  authController.changePassword
);

// Logout
router.post('/logout', auth, authController.logout);

module.exports = router;
