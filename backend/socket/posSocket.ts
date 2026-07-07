const { PosReservation } = require('../models');
import { Op } from 'sequelize';
import jwt from 'jsonwebtoken';
const logger = require('../config/logger');

/**
 * Socket.io handlers for POS real-time events
 */
export = (io: any) => {
  // Authenticate via middleware (before 'connection' fires)
  io.use((socket: any, next: any) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const user: any = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      socket.data.user = user;
      next();
    } catch (err: any) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: any) => {
    // User already authenticated and stored in socket.data.user by middleware
    socket.data.session_id = null;
    socket.data.tab_id = null;

    // Join global POS room
    socket.join('pos-room');

    // Event: POS tab joins (client sends this after connecting)
    socket.on('pos:join', async ({ session_id, tab_id }: any) => {
      socket.data.session_id = session_id;
      socket.data.tab_id = tab_id;

      // Send current state of all reservations to this client
      try {
        const reservations: any = await PosReservation.findAll({
          where: { expires_at: { [Op.gte]: new Date() } },
          attributes: ['product_id', 'presentation_id', 'units_reserved'],
          raw: true
        });

        // Group by product_id to send total reserved per product
        const byProduct: Record<string, any> = {};
        reservations.forEach((r: any) => {
          if (!byProduct[r.product_id]) {
            byProduct[r.product_id] = 0;
          }
          byProduct[r.product_id] += parseFloat(r.units_reserved);
        });

        socket.emit('reservations:init', byProduct);
      } catch (err: any) {
        logger.error('Error fetching reservations on pos:join', { error: err.message });
      }
    });

    // Event: Client disconnects (release all its reservations)
    socket.on('disconnect', async () => {
      if (socket.data.session_id && socket.data.tab_id) {
        try {
          // Find all products affected by this tab's reservations
          const reservations: any = await PosReservation.findAll({
            where: {
              session_id: socket.data.session_id,
              tab_id: socket.data.tab_id
            },
            attributes: ['product_id']
          });

          const affectedProducts = [...new Set(reservations.map((r: any) => r.product_id))];

          // Delete all reservations for this tab
          await PosReservation.destroy({
            where: {
              session_id: socket.data.session_id,
              tab_id: socket.data.tab_id
            }
          });

          // Broadcast updates for affected products
          for (const product_id of affectedProducts) {
            const totalReserved = await PosReservation.sum('units_reserved', {
              where: { product_id, expires_at: { [Op.gte]: new Date() } }
            }) || 0;

            io.to('pos-room').emit('reservation:changed', {
              product_id,
              total_reserved: totalReserved,
              action: 'disconnect'
            });
          }
        } catch (err: any) {
          logger.error('Error releasing reservations on disconnect', { error: err.message });
        }
      }
    });
  });
};
