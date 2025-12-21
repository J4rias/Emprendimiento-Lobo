const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// Aplicar autenticación a todas las rutas
router.use(auth);

// Rutas de usuarios
router.get('/', authorize('users.view'), userController.getAllUsers);
router.get('/:id', authorize('users.view'), userController.getUserById);
router.post('/', authorize('users.create'), userController.createUser);
router.put('/:id', authorize('users.update'), userController.updateUser);
router.delete('/:id', authorize('users.delete'), userController.deleteUser);

module.exports = router;
