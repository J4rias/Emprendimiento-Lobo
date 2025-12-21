const { Role, Permission, RolePermission } = require('../models');
const { Op } = require('sequelize');

/**
 * Obtener todos los roles
 */
exports.getAllRoles = async (req, res, next) => {
  try {
    const roles = await Role.findAll({
      include: [
        {
          model: Permission,
          as: 'permissions',
          through: { attributes: [] },
        },
      ],
      order: [['name', 'ASC']],
    });

    res.json({
      success: true,
      data: { roles },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener un rol por ID
 */
exports.getRoleById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const role = await Role.findByPk(id, {
      include: [
        {
          model: Permission,
          as: 'permissions',
          through: { attributes: [] },
        },
      ],
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado',
      });
    }

    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Crear un nuevo rol
 */
exports.createRole = async (req, res, next) => {
  try {
    const { name, description, is_active, permissions } = req.body;

    // Crear el rol
    const role = await Role.create({
      name,
      description,
      is_active,
    });

    // Asignar permisos si se proporcionaron
    if (permissions && permissions.length > 0) {
      await role.setPermissions(permissions);
    }

    // Cargar el rol con sus permisos
    const fullRole = await Role.findByPk(role.id, {
      include: [
        {
          model: Permission,
          as: 'permissions',
          through: { attributes: [] },
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Rol creado exitosamente',
      data: fullRole,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar un rol
 */
exports.updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, is_active, permissions } = req.body;

    const role = await Role.findByPk(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado',
      });
    }

    // Actualizar datos básicos
    await role.update({
      name: name || role.name,
      description: description !== undefined ? description : role.description,
      is_active: is_active !== undefined ? is_active : role.is_active,
    });

    // Actualizar permisos si se proporcionaron
    if (permissions !== undefined) {
      await role.setPermissions(permissions);
    }

    // Cargar el rol con sus permisos
    const fullRole = await Role.findByPk(role.id, {
      include: [
        {
          model: Permission,
          as: 'permissions',
          through: { attributes: [] },
        },
      ],
    });

    res.json({
      success: true,
      message: 'Rol actualizado exitosamente',
      data: fullRole,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar un rol
 */
exports.deleteRole = async (req, res, next) => {
  try {
    const { id } = req.params;

    const role = await Role.findByPk(id);

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado',
      });
    }

    // Verificar si hay usuarios con este rol
    const { User } = require('../models');
    const usersCount = await User.count({ where: { role_id: id } });

    if (usersCount > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar el rol porque tiene ${usersCount} usuario(s) asignado(s)`,
      });
    }

    await role.destroy();

    res.json({
      success: true,
      message: 'Rol eliminado exitosamente',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener todos los permisos
 */
exports.getAllPermissions = async (req, res, next) => {
  try {
    const permissions = await Permission.findAll({
      order: [
        ['module', 'ASC'],
        ['action', 'ASC'],
      ],
    });

    res.json({
      success: true,
      data: { permissions },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;
