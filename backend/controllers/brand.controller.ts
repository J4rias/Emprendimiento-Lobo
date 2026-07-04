import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import Brand from '../models/Brand';
const { brandService } = require('../services/brand.service');

// Get all brands with pagination and search
export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page: pageStr = '1', limit: limitStr = '25', search = '', sort_by = 'name', sort_dir = 'ASC' } = req.query as Record<string, string>;
    const page = parseInt(pageStr, 10);
    const limit = parseInt(limitStr, 10);
    const offset = (page - 1) * limit;

    const where = {
      [Op.or]: [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ]
    };

    const { count, rows: brands } = await Brand.findAndCountAll({
      where,
      order: [[sort_by, sort_dir.toUpperCase()] as [string, string]],
      limit,
      offset
    });

    res.json({
      data: brands,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get brand by ID
export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const brand = await brandService.getById(id);

    res.json({
      data: brand
    });
  } catch (error) {
    if (error.message === 'Marca no encontrada') {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

// Create new brand
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brandData = {
      ...req.body,
      created_by: (req as any).user.id
    };

    const brand = await brandService.create(brandData);

    res.status(201).json({
      message: 'Marca creada exitosamente',
      data: brand
    });
  } catch (error) {
    if (error.message === 'Marca duplicada') {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
};

// Update brand
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updated_by: (req as any).user.id };

    const brand = await brandService.update(id, updateData);

    res.json({
      message: 'Marca actualizada exitosamente',
      data: brand
    });
  } catch (error) {
    if (error.message === 'Marca no encontrada') {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

// Delete brand (soft delete)
export const deleteBrand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await brandService.deactivate(id);

    res.json({
      message: 'Marca desactivada exitosamente'
    });
  } catch (error) {
    if (error.message === 'Marca no encontrada') {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};

// Get active brands for dropdowns
export const getActive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brands = await brandService.getAll();

    res.json({
      data: brands
    });
  } catch (error) {
    next(error);
  }
};