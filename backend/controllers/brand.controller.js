const { brandService } = require('../services/brand.service');

// Get all brands with pagination and search
const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 25, search = '' } = req.query;
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
const create = async (req, res, next) => {
  try {
    const brandData = {
      ...req.body,
      created_by: req.user.id
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
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updated_by: req.user.id };

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
const deleteBrand = async (req, res, next) => {
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
const getActive = async (req, res, next) => {
  try {
    const brands = await brandService.getAll();

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