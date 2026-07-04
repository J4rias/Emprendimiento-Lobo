const { Brand } = require('../models');
const { Op } = require('sequelize');

const brandService = {
  async getAll() {
    return await Brand.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']],
      attributes: ['id', 'name']
    });
  },

  async getById(id) {
    const brand = await Brand.findByPk(id);
    if (!brand) {
      throw new Error('Marca no encontrada');
    }
    return brand;
  },

  async create(data) {
    const existingBrand = await Brand.findOne({ where: { name: data.name } });
    if (existingBrand) {
      throw new Error('Marca duplicada');
    }

    return await Brand.create(data);
  },

  async update(id, data) {
    const brand = await this.getById(id);
    await brand.update(data);
    return brand;
  },

  async deactivate(id) {
    const brand = await this.getById(id);
    await brand.update({ is_active: false });
  }
};

module.exports = { brandService };