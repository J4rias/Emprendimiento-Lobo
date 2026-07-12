import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';

import Category from '../models/Category';
import Product from '../models/Product';
const { sequelize } = require('../config/database');

class CategoryController {
  // Get all categories
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { page: pageStr = '1', limit: limitStr = '50', search } = req.query as Record<string, string>;
      const page = parseInt(pageStr, 10);
      const limit = parseInt(limitStr, 10);
      const offset = (page - 1) * limit;

      const where: any = {};
      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      const categories = await Category.findAll({
        where,
        order: [['name', 'ASC'] as [string, string]],
        limit: limit,
        offset: offset
      }) as any[];

      // Get total count without pagination
      const totalCount = await Category.count({ where });

      // Count products for each category
      const categoryIds = categories.map((c: any) => c.id);
      const productCounts = await Product.findAll({
        where: { category_id: { [Op.in]: categoryIds }, is_active: true },
        attributes: ['category_id', [sequelize.fn('COUNT', sequelize.col('id')), 'productCount']],
        group: ['category_id'],
        raw: true
      }) as any[];

      const countByCategoryId: Record<number, number> = {};
      for (const row of productCounts) {
        countByCategoryId[row.category_id] = parseInt(row.productCount) || 0;
      }

      const categoriesWithCount = categories.map((category: any) => ({
        ...category.toJSON(),
        productCount: countByCategoryId[category.id] || 0
      }));

      res.json({
        data: categoriesWithCount,
        pagination: {
          total: totalCount,
          page: page,
          limit: limit,
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get category by ID
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const category = await Category.findByPk(id) as any;

      if (!category) {
        return res.status(404).json({
          message: 'Categoría no encontrada'
        });
      }

      res.json({
        data: category
      });
    } catch (error) {
      next(error);
    }
  }

  // Create category
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, name, description, color } = req.body;

      // Check if category name or code already exists
      const existingCategory = await Category.findOne({
        where: {
          [Op.or]: [
            { name: name.trim() },
            { code: code.trim().toUpperCase() }
          ]
        }
      }) as any;

      if (existingCategory) {
        const field = existingCategory.name === name.trim() ? 'nombre' : 'código';
        return res.status(409).json({
          message: `Ya existe una categoría con ese ${field}`
        });
      }

      const category = await Category.create({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#6B7280'
      } as any) as any;

      res.status(201).json({
        message: 'Categoría creada exitosamente',
        data: category
      });
    } catch (error) {
      next(error);
    }
  }

  // Update category
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { code, name, description, color } = req.body;

      const category = await Category.findByPk(id) as any;

      if (!category) {
        return res.status(404).json({
          message: 'Categoría no encontrada'
        });
      }

      // Check if name or code is being changed and if they already exist
      const where: any = {
        id: { [Op.ne]: id },
        [Op.or]: []
      };

      if (name && name.trim() !== category.name) {
        where[Op.or].push({ name: name.trim() });
      }

      if (code && code.trim().toUpperCase() !== category.code) {
        where[Op.or].push({ code: code.trim().toUpperCase() });
      }

      if (where[Op.or].length > 0) {
        const existingCategory = await Category.findOne({ where }) as any;

        if (existingCategory) {
          const field = existingCategory.name === name?.trim() ? 'nombre' : 'código';
          return res.status(409).json({
            message: `Ya existe una categoría con ese ${field}`
          });
        }
      }

      await category.update({
        code: code ? code.trim().toUpperCase() : category.code,
        name: name ? name.trim() : category.name,
        description: description !== undefined ? description?.trim() || null : category.description,
        color: color || category.color
      } as any);

      res.json({
        message: 'Categoría actualizada exitosamente',
        data: category
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete category
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const category = await Category.findByPk(id, {
        include: [{
          association: 'products',
          attributes: ['id']
        }]
      }) as any;

      if (!category) {
        return res.status(404).json({
          message: 'Categoría no encontrada'
        });
      }

      // Check if category has products
      if (category.products && category.products.length > 0) {
        return res.status(400).json({
          message: 'No se puede eliminar la categoría porque tiene productos asociados'
        });
      }

      await category.destroy();

      res.json({
        message: 'Categoría eliminada exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Get categories with product count
  async getWithProductCount(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await Category.findAll({
        attributes: [
          'id',
          'code',
          'name',
          'description',
          'color',
          'created_at',
          [
            require('sequelize').literal(`(
              SELECT COUNT(*)
              FROM products
              WHERE products.category_id = Category.id
              AND products.is_active = true
            )`),
            'product_count'
          ]
        ],
        order: [['name', 'ASC'] as [string, string]]
      }) as any[];

      res.json({
        data: categories
      });
    } catch (error) {
      next(error);
    }
  }
}

export = new CategoryController();
