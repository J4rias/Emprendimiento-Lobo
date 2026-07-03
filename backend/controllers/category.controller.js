const { Category, Product } = require('../models');
const { Op } = require('sequelize');

class CategoryController {
  // Get all categories
  async getAll(req, res, next) {
    try {
      const { page = 1, limit = 50, search } = req.query;
      const offset = (page - 1) * limit;

      const where = {};
      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      const categories = await Category.findAll({
        where,
        order: [['name', 'ASC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Get total count without pagination
      const totalCount = await Category.count({ where });

      // Count products for each category
      const categoriesWithCount = await Promise.all(
        categories.map(async (category) => {
          const productCount = await Product.count({
            where: {
              category_id: category.id,
              is_active: true
            }
          });
          return {
            ...category.toJSON(),
            productCount
          };
        })
      );

      res.json({
        data: categoriesWithCount,
        pagination: {
          total: totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get category by ID
  async getById(req, res, next) {
    try {
      const { id } = req.params;

      const category = await Category.findByPk(id);

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
  async create(req, res, next) {
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
      });

      if (existingCategory) {
        const field = existingCategory.name === name.trim() ? 'nombre' : 'código';
        return res.status(400).json({
          message: `Ya existe una categoría con ese ${field}`
        });
      }

      const category = await Category.create({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#6B7280'
      });

      res.status(201).json({
        message: 'Categoría creada exitosamente',
        data: category
      });
    } catch (error) {
      next(error);
    }
  }

  // Update category
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { code, name, description, color } = req.body;

      const category = await Category.findByPk(id);

      if (!category) {
        return res.status(404).json({
          message: 'Categoría no encontrada'
        });
      }

      // Check if name or code is being changed and if they already exist
      const where = {
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
        const existingCategory = await Category.findOne({ where });

        if (existingCategory) {
          const field = existingCategory.name === name?.trim() ? 'nombre' : 'código';
          return res.status(400).json({
            message: `Ya existe una categoría con ese ${field}`
          });
        }
      }

      await category.update({
        code: code ? code.trim().toUpperCase() : category.code,
        name: name ? name.trim() : category.name,
        description: description !== undefined ? description?.trim() || null : category.description,
        color: color || category.color
      });

      res.json({
        message: 'Categoría actualizada exitosamente',
        data: category
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete category
  async delete(req, res, next) {
    try {
      const { id } = req.params;

      const category = await Category.findByPk(id, {
        include: [{
          association: 'products',
          attributes: ['id']
        }]
      });

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
  async getWithProductCount(req, res, next) {
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
        order: [['name', 'ASC']]
      });

      res.json({
        data: categories
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CategoryController();
