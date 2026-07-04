import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';

import Role from '../models/Role';
import Permission from '../models/Permission';
import RolePermission from '../models/RolePermission';

const { User } = require('../models');

export const getAllRoles = async (req: Request, res: Response, next: NextFunction) => {
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
    }) as any[];

    res.json({
      data: { roles },
    });
  } catch (error) {
    next(error);
  }
};

export const getRoleById = async (req: Request, res: Response, next: NextFunction) => {
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
    }) as any;

    if (!role) {
      return res.status(404).json({
        message: 'Rol no encontrado',
      });
    }

    res.json({
      data: role,
    });
  } catch (error) {
    next(error);
  }
};

export const createRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, is_active, permissions } = req.body;

    // Crear el rol
    const role = await Role.create({
      name,
      description,
      is_active,
    }) as any;

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
    }) as any;

    res.status(201).json({
      message: 'Rol creado exitosamente',
      data: fullRole,
    });
  } catch (error) {
    next(error);
  }
};

export const updateRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, is_active, permissions } = req.body;

    const role = await Role.findByPk(id) as any;

    if (!role) {
      return res.status(404).json({
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
    }) as any;

    res.json({
      message: 'Rol actualizado exitosamente',
      data: fullRole,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const role = await Role.findByPk(id) as any;

    if (!role) {
      return res.status(404).json({
        message: 'Rol no encontrado',
      });
    }

    // Verificar si hay usuarios con este rol
    const usersCount = await User.count({ where: { role_id: id } });

    if (usersCount > 0) {
      return res.status(400).json({
        message: `No se puede eliminar el rol porque tiene ${usersCount} usuario(s) asignado(s)`,
      });
    }

    await role.destroy();

    res.json({
      message: 'Rol eliminado exitosamente',
    });
  } catch (error) {
    next(error);
  }
};

export const getAllPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const permissions = await Permission.findAll({
      order: [
        ['module', 'ASC'],
        ['action', 'ASC'],
      ],
    }) as any[];

    res.json({
      data: { permissions },
    });
  } catch (error) {
    next(error);
  }
};