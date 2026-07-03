const { Brand } = require('../models');
const { Op } = require('sequelize');

// Get all brands with pagination and search
const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    const where = {
      [Op.or]: [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ]
    };

    const { count, rows: brands } = await Brand.findAndCountAll({
      where,
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      data: brands,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get brand by ID
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const brand = await Brand.findByPk(id);

    if (!brand) {
      return res.status(404).json({
        message: 'Marca no encontrada'
      });
    }

    res.json({
      data: brand
    });
  } catch (error) {
    next(error);
  }
};

// Create new brand
const create = async (req, res, next) => {
  try {
    const brandData = {
      ...req.body,
      created_by: req.user.id
    };

    const brand = await Brand.create(brandData);

    res.status(201).json({
      message: 'Marca creada exitosamente',
      data: brand
    });
  } catch (error) {
    next(error);
  }
};

// Update brand
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updated_by: req.user.id };

    const brand = await Brand.findByPk(id);
    if (!brand) {
      return res.status(404).json({
        message: 'Marca no encontrada'
      });
    }

    await brand.update(updateData);

    res.json({
      message: 'Marca actualizada exitosamente',
      data: brand
    });
  } catch (error) {
    next(error);
  }
};

// Delete brand (soft delete)
const deleteBrand = async (req, res, next) => {
  try {
    const { id } = req.params;
    const brand = await Brand.findByPk(id);

    if (!brand) {
      return res.status(404).json({
        message: 'Marca no encontrada'
      });
    }

    await brand.update({ is_active: false });

    res.json({
      message: 'Marca desactivada exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

// Get active brands for dropdowns
const getActive = async (req, res, next) => {
  try {
    const brands = await Brand.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']],
      attributes: ['id', 'name']
    });

    res.json({
      data: brands
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteBrand,
  getActive
};