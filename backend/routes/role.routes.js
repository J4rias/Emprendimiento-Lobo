const express = require('express');
const router = express.Router();
const roleController = require('../controllers/role.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// Aplicar autenticación a todas las rutas
router.use(auth);

// Rutas de roles (montadas en /api/roles — sin prefijo /roles interno)
router.get('/', authorize('roles.manage'), roleController.getAllRoles);
router.get('/permissions', authorize('roles.manage'), roleController.getAllPermissions);
router.get('/:id', authorize('roles.manage'), roleController.getRoleById);
router.post('/', authorize('roles.manage'), roleController.createRole);
router.put('/:id', authorize('roles.manage'), roleController.updateRole);
router.delete('/:id', authorize('roles.manage'), roleController.deleteRole);

module.exports = router;
