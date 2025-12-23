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
            where: { category_id: category.id }
          });
          return {
            ...category.toJSON(),
            productCount
          };
        })
      );

      res.json({
        success: true,
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
          success: false,
          message: 'Categoría no encontrada'
        });
      }

      res.json({
        success: true,
        data: category
      });
    } catch (error) {
      next(error);
    }
  }

  // Create category
  async create(req, res, next) {
    try {
      const { name, description, color } = req.body;

      // Check if category name already exists
      const existingCategory = await Category.findOne({
        where: { name: name.trim() }
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe una categoría con ese nombre'
        });
      }

      const category = await Category.create({
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#6B7280'
      });

      res.status(201).json({
        success: true,
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
      const { name, description, color } = req.body;

      const category = await Category.findByPk(id);
      
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Categoría no encontrada'
        });
      }

      // Check if name is being changed and if new name already exists
      if (name && name.trim() !== category.name) {
        const existingCategory = await Category.findOne({
          where: { 
            name: name.trim(),
            id: { [Op.ne]: id }
          }
        });

        if (existingCategory) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe una categoría con ese nombre'
          });
        }
      }

      await category.update({
        name: name ? name.trim() : category.name,
        description: description !== undefined ? description?.trim() || null : category.description,
        color: color || category.color
      });

      res.json({
        success: true,
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
          success: false,
          message: 'Categoría no encontrada'
        });
      }

      // Check if category has products
      if (category.products && category.products.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar la categoría porque tiene productos asociados'
        });
      }

      await category.destroy();

      res.json({
        success: true,
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
        success: true,
        data: categories
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CategoryController();
