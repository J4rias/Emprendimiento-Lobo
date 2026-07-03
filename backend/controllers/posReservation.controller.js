const { PosReservation, Inventory, Product, ProductPresentation, Warehouse, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Reserve or update a product reservation for a POS tab
 * POST /api/pos/reserve
 */
exports.reserve = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      session_id,
      tab_id,
      product_id,
      presentation_id,
      units_requested
    } = req.body;
    const user_id = req.user.id;

    // Validaciones básicas
    if (!session_id || !tab_id || !user_id || !product_id || !presentation_id || units_requested === undefined) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Faltan parámetros requeridos'
      });
    }

    // Verificar que el producto existe
    const product = await Product.findByPk(product_id, { transaction });
    if (!product) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Producto no encontrado'
      });
    }

    // Verificar que la presentación existe
    const presentation = await ProductPresentation.findByPk(presentation_id, { transaction });
    if (!presentation) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Presentación no encontrada'
      });
    }

    // Obtener el warehouse activo
    const warehouse = await Warehouse.findOne({ where: { is_active: true }, transaction });
    if (!warehouse) {
      await transaction.rollback();
      return res.status(400).json({ message: 'No hay almacén configurado' });
    }

    const inventory = await Inventory.findOne({
      where: { product_id, warehouse_id: warehouse.id },
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!inventory) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'No hay inventario registrado para este producto'
      });
    }

    // Calcular reservas de OTROS tabs (excluyendo la reserva actual de este session+tab)
    // NOT (session_id = A AND tab_id = B)  ≡  (session_id != A  OR  tab_id != B)
    // Solo contar reservas no expiradas
    const reservedByOthers = await PosReservation.sum('units_reserved', {
      where: {
        product_id,
        expires_at: { [Op.gte]: new Date() },
        [Op.or]: [
          { session_id: { [Op.ne]: session_id } },
          { tab_id: { [Op.ne]: tab_id } }
        ]
      },
      transaction
    }) || 0;

    const available = parseFloat(inventory.quantity) - parseFloat(reservedByOthers);

    // Si no hay stock disponible, rechazar con 409
    if (available < units_requested) {
      await transaction.rollback();
      return res.status(409).json({
        conflict: true,
        message: 'Stock insuficiente',
        product_name: product.name,
        available: Math.max(0, available),
        requested: units_requested,
        reserved_by_others: parseFloat(reservedByOthers)
      });
    }

    // UPSERT: crear o actualizar reserva
    const [reservation, created] = await PosReservation.findOrCreate({
      where: { session_id, tab_id, presentation_id },
      defaults: {
        session_id,
        tab_id,
        user_id,
        product_id,
        presentation_id,
        units_reserved: units_requested,
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 horas
      },
      transaction
    });

    if (!created) {
      // Actualizar cantidad y TTL
      await reservation.update({
        units_reserved: units_requested,
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000)
      }, { transaction });
    }

    await transaction.commit();

    // Obtener el total de reservas no expiradas para el broadcast
    const totalReservedNow = await PosReservation.sum('units_reserved', {
      where: { product_id, expires_at: { [Op.gte]: new Date() } }
    }) || 0;

    // Emitir evento a través de Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to('pos-room').emit('reservation:changed', {
        product_id,
        presentation_id,
        total_reserved: totalReservedNow,
        action: 'reserve'
      });
    }

    res.status(200).json({
      message: 'Reserva actualizada',
      data: {
        reserved: units_requested,
        available_after: available - units_requested,
        total_reserved: totalReservedNow
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Release a product reservation (reduce quantity or delete if quantity = 0)
 * PATCH /api/pos/reserve
 */
exports.releaseItem = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      session_id,
      tab_id,
      presentation_id,
      units_to_release
    } = req.body;

    if (!session_id || !tab_id || !presentation_id) {
      await transaction.rollback();
      return res.status(400).json({
        message: 'Faltan parámetros requeridos'
      });
    }

    const reservation = await PosReservation.findOne({
      where: { session_id, tab_id, presentation_id },
      transaction
    });

    if (!reservation) {
      await transaction.rollback();
      return res.status(404).json({
        message: 'Reserva no encontrada'
      });
    }

    const product_id = reservation.product_id;
    const newUnits = Math.max(0, parseFloat(reservation.units_reserved) - parseFloat(units_to_release || 0));

    if (newUnits === 0) {
      await reservation.destroy({ transaction });
    } else {
      await reservation.update({ units_reserved: newUnits }, { transaction });
    }

    await transaction.commit();

    // Obtener total de reservas no expiradas para este producto
    const totalReservedNow = await PosReservation.sum('units_reserved', {
      where: { product_id, expires_at: { [Op.gte]: new Date() } }
    }) || 0;

    // Emitir evento
    const io = req.app.get('io');
    if (io) {
      io.to('pos-room').emit('reservation:changed', {
        product_id,
        presentation_id,
        total_reserved: totalReservedNow,
        action: 'release'
      });
    }

    res.status(200).json({
      message: 'Reserva liberada',
      data: {
        remaining_reserved: newUnits,
        total_reserved: totalReservedNow
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Release all reservations for a specific tab
 * DELETE /api/pos/tab
 */
exports.releaseTab = async (req, res, next) => {
  try {
    const {
      session_id,
      tab_id
    } = req.body;

    if (!session_id || !tab_id) {
      return res.status(400).json({
        message: 'Faltan parámetros requeridos'
      });
    }

    // Obtener todos los product_ids antes de eliminar (para broadcast)
    const reservations = await PosReservation.findAll({
      where: { session_id, tab_id },
      attributes: ['product_id']
    });

    const affectedProducts = [...new Set(reservations.map(r => r.product_id))];

    // Eliminar todas las reservas de esta tab
    await PosReservation.destroy({
      where: { session_id, tab_id }
    });

    // Emitir evento para cada producto afectado
    const io = req.app.get('io');
    if (io && affectedProducts.length > 0) {
      for (const product_id of affectedProducts) {
        const totalReservedNow = await PosReservation.sum('units_reserved', {
          where: { product_id, expires_at: { [Op.gte]: new Date() } }
        }) || 0;

        io.to('pos-room').emit('reservation:changed', {
          product_id,
          total_reserved: totalReservedNow,
          action: 'release_tab'
        });
      }
    }

    res.status(200).json({
      message: 'Reservas de la pestaña liberadas',
      data: {
        affected_products: affectedProducts
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all current reservations (for initialization on client)
 * GET /api/pos/reservations
 */
exports.getAll = async (req, res, next) => {
  try {
    const reservations = await PosReservation.findAll({
      where: { expires_at: { [Op.gte]: new Date() } },
      attributes: ['product_id', 'presentation_id', 'units_reserved'],
      raw: true
    });

    // Agrupar por product_id para devolver el total reservado por producto
    const byProduct = {};
    reservations.forEach(r => {
      if (!byProduct[r.product_id]) {
        byProduct[r.product_id] = 0;
      }
      byProduct[r.product_id] += parseFloat(r.units_reserved);
    });

    res.status(200).json({
      data: byProduct
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cleanup expired reservations (called by a cron job or manual trigger)
 * POST /api/pos/cleanup-expired
 */
exports.cleanupExpired = async (req, res, next) => {
  try {
    const now = new Date();

    // Obtener las reservas a eliminar (para broadcast)
    const expiredReservations = await PosReservation.findAll({
      where: {
        expires_at: { [Op.lt]: now }
      },
      attributes: ['product_id']
    });

    const affectedProducts = [...new Set(expiredReservations.map(r => r.product_id))];

    // Eliminar reservas expiradas
    const deletedCount = await PosReservation.destroy({
      where: {
        expires_at: { [Op.lt]: now }
      }
    });

    // Emitir evento para cada producto afectado
    const io = req.app.get('io');
    if (io && affectedProducts.length > 0) {
      for (const product_id of affectedProducts) {
        const totalReservedNow = await PosReservation.sum('units_reserved', {
          where: { product_id, expires_at: { [Op.gte]: new Date() } }
        }) || 0;

        io.to('pos-room').emit('reservation:changed', {
          product_id,
          total_reserved: totalReservedNow,
          action: 'cleanup'
        });
      }
    }

    res.status(200).json({
      message: `${deletedCount} reservas expiradas eliminadas`,
      data: {
        deleted_count: deletedCount,
        affected_products: affectedProducts
      }
    });
  } catch (error) {
    next(error);
  }
};