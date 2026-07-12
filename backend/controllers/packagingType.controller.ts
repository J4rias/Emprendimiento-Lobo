import { Request, Response, NextFunction } from 'express';
import PackagingType from '../models/PackagingType';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await PackagingType.findAll({
      order: [['name', 'ASC']] as [string, string][],
    }) as any[];
    res.json({ data: items });
  } catch (error) {
    next(error);
  }
};

export const getActive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await PackagingType.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']] as [string, string][],
      attributes: ['id', 'name', 'description'],
    }) as any[];
    res.json({ data: items });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await PackagingType.findByPk(req.params.id) as any;
    if (!item) return res.status(404).json({ message: 'Tipo de empaque no encontrado' });
    res.json({ data: item });
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'El nombre es requerido' });
    const item = await PackagingType.create({ name, description }) as any;
    res.status(201).json({ data: item });
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await PackagingType.findByPk(req.params.id) as any;
    if (!item) return res.status(404).json({ message: 'Tipo de empaque no encontrado' });
    const { name, description, is_active } = req.body;
    await item.update({ name, description, is_active });
    res.json({ data: item });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await PackagingType.findByPk(req.params.id) as any;
    if (!item) return res.status(404).json({ message: 'Tipo de empaque no encontrado' });
    await item.destroy();
    res.json({ message: 'Tipo de empaque eliminado' });
  } catch (error) {
    next(error);
  }
};

export default { getAll, getActive, getById, create, update, remove };
