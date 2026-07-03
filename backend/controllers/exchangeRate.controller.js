const logger = require('../config/logger');
const { ExchangeRate, User } = require('../models');
const { Op } = require('sequelize');

class ExchangeRateController {
  // Get all exchange rates with filters
  async getAll(req, res, next) {
    try {
      const {
        page = 1,
        limit = 50,
        from_currency,
        to_currency,
        date_from,
        date_to,
        is_active
      } = req.query;

      const offset = (page - 1) * limit;
      const where = {};

      if (from_currency) where.from_currency = from_currency;
      if (to_currency) where.to_currency = to_currency;
      if (is_active !== undefined) {
        if (is_active === 'false') where.is_active = false;
        else if (is_active === 'all') { /* include all */ }
        else where.is_active = is_active === 'true';
      } else {
        // Por defecto mostrar solo las activas
        where.is_active = true;
      }

      if (date_from || date_to) {
        where.effective_date = {};
        if (date_from) where.effective_date[Op.gte] = date_from;
        if (date_to) where.effective_date[Op.lte] = date_to;
      }

      const { rows: rates, count } = await ExchangeRate.findAndCountAll({
        where,
        include: [
          { model: User, as: 'creator', attributes: ['id', 'username', 'first_name', 'last_name'] },
          { model: User, as: 'updater', attributes: ['id', 'substring', 'first_name', 'last_name'] }
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['effective_date', 'DESC'], ['created_at', 'DESC']]
      });

      res.json({
        data: rates,
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
  }

  // Get current/latest exchange rates
  async getLatest(req, res, next) {
    try {
      const { date } = req.query;
      const effectiveDate = date || new Date().toISOString().split('T')[0];

      // Obtener todas las tasas para la fecha especificada
      const rates = await ExchangeRate.findAll({
        where: {
          effective_date: effectiveDate,
          is_active: true
        },
        include: [
          { model: User, as: 'creator', attributes: ['id', 'username'] }
        ],
        order: [['from_currency', 'ASC'], ['to_currency', 'ASC']]
      });

      // Si no hay tasas para esa fecha, buscar las más recientes
      if (rates.length === 0) {
        const latestRates = await ExchangeRate.findAll({
          where: {
            is_active: true,
            effective_date: {
              [Op.lte]: effectiveDate
            }
          },
          order: [['effective_date', 'DESC'], ['created_at', 'DESC']],
          limit: 20
        });

        return res.json({
          data: latestRates,
          message: 'No hay tasas para la fecha especificada. Se muestran las más recientes.'
        });
      }

      res.json({
        data: rates
      });
    } catch (error) {
      next(error);
    }
  }

  // Get exchange rate by ID
  async getById(req, res, next) {
    try {
      const { id } = req.params;

      const rate = await ExchangeRate.findByPk(id, {
        include: [
          { model: User, as: 'creator', attributes: ['id', 'username', 'first_name', 'last_name'] },
          { model: User, as: 'updater', attributes: ['id', 'username', 'first_name', 'last_name'] }
        ]
      });

      if (!rate) {
        return res.status(404).json({
          message: 'Tasa de cambio no encontrada'
        });
      }

      res.json({
        data: rate
      });
    } catch (error) {
      next(error);
    }
  }

  // Create exchange rate
  async create(req, res, next) {
    try {
      const {
        from_currency,
        to_currency,
        rate,
        effective_date,
        source,
        notes
      } = req.body;

      // Validar que no sean la misma moneda
      if (from_currency === to_currency) {
        return res.status(400).json({
          message: 'La moneda origen y destino no pueden ser iguales'
        });
      }

      // Verificar si ya existe una tasa para esa combinación y fecha
      const existing = await ExchangeRate.findOne({
        where: {
          from_currency,
          to_currency,
          effective_date
        }
      });

      if (existing) {
        if (!existing.is_active) {
          // Si existe una pero está inactiva, la eliminamos físicamente para crear la nueva sin conflicto
          await existing.destroy();
        } else {
          return res.status(409).json({
            message: `Ya existe una tasa de cambio de ${from_currency} a ${to_currency} para la fecha ${effective_date}`
          });
        }
      }

      // Crear la tasa de cambio
      const exchangeRate = await ExchangeRate.create({
        from_currency,
        to: to_currency,
        rate,
        effective_date,
        source,
        notes,
        created_by: req.user.id,
        updated_by: req.user.id
      });

      // Recargar con relaciones
      await exchangeRate.reload({
        include: [
          { model: User, as: 'creator', attributes: ['id', 'username'] }
        ]
      });

      res.status(201).json({
        message: 'Tasa de cambio creada exitosamente',
        data: exchangeRate
      });
    } catch (error) {
      next(error);
    }
  }

  // Update exchange rate
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };
      delete updateData.created_by;

      const exchangeRate = await ExchangeRate.findByPk(id);

      if (!exchangeRate) {
        return res.status(404).json({
          message: 'Tasa de cambio no encontrada'
        });
      }

      // Si se actualiza la combinación de monedas o fecha, verificar unicidad
      if (updateData.from_currency || updateData.to_currency || updateData.effective_date) {
        const from = updateData.from_currency || exchangeRate.from_currency;
        const to = updateData.to_currency || exchangeRate.to_currency;
        const date = updateData.effective_date || exchangeRate.effective_date;

        if (from === to) {
          return res.status(400).json({
            message: 'La moneda origen y destino no pueden ser iguales'
          });
        }

        const existing = await ExchangeRate.findOne({
          where: {
            from_currency: from,
            to_currency: to,
            effective_date: date,
            id: { [Op.ne]: id }
          }
        });

        if (existing) {
          return res.status(409).json({
            message: `Ya existe una tasa de cambio de ${from} a ${to} para la fecha ${date}`
          });
        }
      }

      // Actualizar
      await exchangeRate.update({
        ...updateData,
        updated_by: req.user.id
      });

      // Recargar con relaciones
      await exchangeRate.reload({
        include: [
          { model: User, as: 'creator', attributes: ['id', 'username'] },
          { model: User, as: 'updater', attributes: ['id', 'username'] }
        ]
      });

      res.json({
        message: 'Tasa de cambio actualizada exitosamente',
        data: exchangeRate
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete exchange rate
  async delete(req, res, next) {
    try {
      const { id } = req.params;

      const exchangeRate = await ExchangeRate.findByPk(id);

      if (!exchangeRate) {
        return res.status(404).json({
          message: 'Tasa de cambio no encontrada'
        });
      }

      // Real delete - no mantenemos historial de tasas erróneas
      await exchangeRate.destroy();

      res.json({
        message: 'Tasa de cambio eliminada exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Convert amount
  async convert(req, res, next) {
    try {
      const { amount, from_currency, to_currency, date } = req.query;

      if (amount === undefined || !from_currency || !to_currency) {
        return res.status(400).json({
          message: 'Se requieren los parámetros: amount (puede ser 0), from_currency, to_currency'
        });
      }

      const convertedAmount = await ExchangeRate.convert(
        parseFloat(amount),
        from_currency,
        to_currency,
        date
      );

      const rate = await ExchangeRate.getRate(from_currency, to_currency, date);

      res.json({
        data: {
          amount: parseFloat(amount),
          from_currency,
          to_currency,
          rate,
          converted_amount: convertedAmount,
          date: date || new Date().toISOString().split('T')[0]
        }
      });
    } catch (error) {
      logger.error('Error al convertir monto', { error: error.message });
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
}

module.exports = new ExchangeRateController();