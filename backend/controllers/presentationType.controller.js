const { PresentationType } = require('../models');

// Get all active presentation types
const getActive = async (req, res, next) => {
  try {
    const presentationTypes = await PresentationType.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']],
      attributes: ['id', 'name', 'description']
    });

    res.json({
      success: true,
      data: presentationTypes
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActive
};
