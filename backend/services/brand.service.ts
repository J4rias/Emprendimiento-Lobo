const { Brand } = require('../models');
import { Op } from 'sequelize';

const brandService = {
  async getAll() {
    return await Brand.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']],
      attributes: ['id', 'name']
    });
  },

  async getById(id: any) {
    const brand = await Brand.findByPk(id);
    if (!brand) {
      throw new Error('Marca no encontrada');
    }
    return brand;
  },

  async create(data: any) {
    const existingBrand = await Brand.findOne({ where: { name: data.name } });
    if (existingBrand) {
      throw new Error('Marca duplicada');
    }

    return await Brand.create(data);
  },

  async update(id: any, data: any) {
    const brand = await this.getById(id);
    await brand.update(data);
    return brand;
  },

  async deactivate(id: any) {
    const brand = await this.getById(id);
    await brand.destroy();
  }
};

export = { brandService };
