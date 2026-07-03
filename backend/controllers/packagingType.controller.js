const { PackagingType } = require('../models');

// Get all active packaging types
const getActive = async (req, res, next) => {
  try {
    const packagingTypes = await PackagingType.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']],
      attributes: ['id', 'name', 'description']
    });

    res.json({
      data: packagingTypes
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActive
};
