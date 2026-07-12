import http from 'http';
import { Server } from 'socket.io';
import { Op } from 'sequelize';
const app = require('./app');
const { testConnection, sequelize } = require('./config/database');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

// Create HTTP server with Socket.io
const httpServer = http.createServer(app);

// Misma lógica de CORS que app.js — env var CORS_ORIGINS (comma-separated) + FRONTEND_URL fallback
const allowedOrigins = [
  ...(process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002',
       'http://localhost:3003', 'http://localhost:3004', 'http://localhost:3005', 'http://localhost:3006']),
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Make io accessible to routes
app.set('io', io);

// Load Socket.io handlers
require('./socket/posSocket')(io);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

    // Sync database (in development only - use migrations in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Syncing database...');
      await sequelize.sync(); // Reverted alter: true due to FK crash
      console.log('✅ Database synced successfully');
    }

    // Cleanup expired POS reservations on startup and every 30 minutes
    const { PosReservation } = require('./models');
    const cleanupExpired = async () => {
      try {
        const deleted = await PosReservation.destroy({
          where: { expires_at: { [Op.lt]: new Date() } }
        });
        if (deleted > 0) {
          console.log(`🧹 Cleaned up ${deleted} expired POS reservations`);
        }
      } catch (err: any) {
        console.error('Error cleaning up expired reservations:', err.message);
      }
    };
    await cleanupExpired();
    setInterval(cleanupExpired, 30 * 60 * 1000);

    // Start listening
    httpServer.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} already in use. Kill the process and retry.`);
        process.exit(1);
      } else {
        throw err;
      }
    });
    httpServer.listen(PORT, () => {
      console.log('');
      console.log('='.repeat(60));
      console.log(`🚀 Sistema de Gestión de Víveres - Backend`);
      console.log('='.repeat(60));
      console.log(`📡 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API URL: http://localhost:${PORT}/api`);
      console.log(`💚 Health check: http://localhost:${PORT}/health`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
      console.log('='.repeat(60));
      console.log('');
    });
  } catch (error: any) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await sequelize.close();
  process.exit(0);
});

// Start the server
startServer();
