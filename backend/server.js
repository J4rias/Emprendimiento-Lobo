const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { testConnection, sequelize } = require('./config/database');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

// Create HTTP server with Socket.io
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:3005',
      'http://localhost:3006',
      process.env.FRONTEND_URL
    ].filter(Boolean),
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

    // Start listening
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
  } catch (error) {
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
