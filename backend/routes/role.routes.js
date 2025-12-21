const express = require('express');
const router = express.Router();
const roleController = require('../controllers/role.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// Aplicar autenticación a todas las rutas
router.use(auth);

// Rutas de roles
router.get('/roles', authorize('roles.manage'), roleController.getAllRoles);
router.get('/roles/:id', authorize('roles.manage'), roleController.getRoleById);
router.post('/roles', authorize('roles.manage'), roleController.createRole);
router.put('/roles/:id', authorize('roles.manage'), roleController.updateRole);
router.delete('/roles/:id', authorize('roles.manage'), roleController.deleteRole);

// Rutas de permisos
router.get('/permissions', authorize('roles.manage'), roleController.getAllPermissions);

module.exports = router;
