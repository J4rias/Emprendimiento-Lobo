// Express type imports (ALWAYS at the top)
import { Request, Response, NextFunction } from 'express';

// Sequelize imports (only what is used in the controller)
import { Op } from 'sequelize';

// Model imports (esModuleInterop — require with export = in the .ts files)
import User from '../models/User';
import Role from '../models/Role';
import Permission from '../models/Permission';

// Other requires that are not models/sequelize/express → leave as require()
const logger = require('../config/logger');
const { sequelize } = require('../config/database');

/**
 * Obtener todos los usuarios
 */
export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, roleId } = req.query as Record<string, string>;

    const where: any = {};

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
    }) as any[];

    res.json({
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener un usuario por ID
 */
export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
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
    }) as any;

    if (!user) {
      return res.status(404).json({
        message: 'Usuario no encontrado',
      });
    }

    res.json({
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Crear un nuevo usuario
 */
export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, email, password, first_name, last_name, phone, role_id, is_active } = req.body;

    if (!username || !email || !password || !first_name || !last_name) {
      return res.status(400).json({
        message: 'Campos requeridos: username, email, password, first_name, last_name',
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }],
      },
    }) as any;

    if (existingUser) {
      return res.status(409).json({
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
    }) as any;

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
    }) as any;

    res.status(201).json({
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
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { email, password, first_name, last_name, phone, role_id, is_active } = req.body;

    const user = await User.findByPk(id) as any;

    if (!user) {
      return res.status(404).json({
        message: 'Usuario no encontrado',
      });
    }

    // Verificar si el email ya existe en otro usuario
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } }) as any;
      if (existingUser) {
        return res.status(409).json({
          message: 'El email ya está en uso',
        });
      }
    }

    // Preparar datos de actualización
    const updateData: any = {
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
    }) as any;

    res.json({
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
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id) as any;

    if (!user) {
      return res.status(404).json({
        message: 'Usuario no encontrado',
      });
    }

    // No permitir eliminar el propio usuario
    if (user.id === (req as any).user.id) {
      return res.status(400).json({
        message: 'No puedes eliminar tu propio usuario',
      });
    }

    await user.destroy();

    res.json({
      message: 'Usuario eliminado exitosamente',
    });
  } catch (error) {
    next(error);
  }
};

