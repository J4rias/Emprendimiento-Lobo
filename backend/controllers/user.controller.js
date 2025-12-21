const { User, Role, Permission } = require('../models');
const { Op } = require('sequelize');

/**
 * Obtener todos los usuarios
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const { search, roleId } = req.query;

    const where = {};

    if (search) {
      where[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
      ];
    }

    if (roleId) {
      where.role_id = roleId;
    }

    const users = await User.findAll({
      where,
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'description'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: { users },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener un usuario por ID
 */
exports.getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Role,
          as: 'role',
          include: [
            {
              model: Permission,
              as: 'permissions',
              through: { attributes: [] },
            },
          ],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Crear un nuevo usuario
 */
exports.createUser = async (req, res, next) => {
  try {
    const { username, email, password, first_name, last_name, phone, role_id, is_active } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'El usuario o email ya existe',
      });
    }

    // Crear el usuario
    const user = await User.create({
      username,
      email,
      password,
      first_name,
      last_name,
      phone,
      role_id,
      is_active: is_active !== undefined ? is_active : true,
    });

    // Obtener el usuario completo sin la contraseña
    const fullUser = await User.findByPk(user.id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'description'],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: fullUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar un usuario
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, password, first_name, last_name, phone, role_id, is_active } = req.body;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    // Verificar si el email ya existe en otro usuario
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'El email ya está en uso',
        });
      }
    }

    // Preparar datos de actualización
    const updateData = {
      email: email || user.email,
      first_name: first_name || user.first_name,
      last_name: last_name || user.last_name,
      phone: phone !== undefined ? phone : user.phone,
      role_id: role_id || user.role_id,
      is_active: is_active !== undefined ? is_active : user.is_active,
    };

    // Solo actualizar la contraseña si se proporciona
    if (password) {
      updateData.password = password;
    }

    await user.update(updateData);

    // Obtener el usuario actualizado sin la contraseña
    const fullUser = await User.findByPk(user.id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'description'],
        },
      ],
    });

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: fullUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar un usuario
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    // No permitir eliminar el propio usuario
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propio usuario',
      });
    }

    await user.destroy();

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;
