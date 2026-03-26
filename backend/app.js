const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');
const { sequelize } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const quoteRoutes = require('./routes/quote.routes');
const roleRoutes = require('./routes/role.routes');
const userRoutes = require('./routes/user.routes');
const saleRoutes = require('./routes/sale.routes');
const categoryRoutes = require('./routes/category.routes');
const supplierRoutes = require('./routes/supplier.routes');
const brandRoutes = require('./routes/brand.routes');
const uploadRoutes = require('./routes/upload.routes');
const exchangeRateRoutes = require('./routes/exchangeRate.routes');
const packagingTypeRoutes = require('./routes/packagingType.routes');
const presentationTypeRoutes = require('./routes/presentationType.routes');
const transferRoutes = require('./routes/transfer.routes');
const customerRoutes = require('./routes/customer.routes');
const purchaseOrderRoutes = require('./routes/purchaseOrder.routes');
const supplierPaymentRoutes = require('./routes/supplierPayment.routes');
const creditNoteRoutes = require('./routes/creditNote.routes');
const deliveryRoutes = require('./routes/delivery.routes');
const companyRoutes = require('./routes/company.routes');
const priceListRoutes = require('./routes/priceList.routes');
const posRoutes = require('./routes/pos.routes');

const app = express();
// Trust nginx-proxy-manager (first proxy hop) so express-rate-limit can read real client IPs
app.set('trust proxy', 1);
// Security middleware con configuración para permitir imágenes
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));

// CORS - Permitir solo localhost
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005',
  'http://localhost:3006',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (como mobile apps o curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['Content-Type', 'Content-Length']
}));

// Rate limiting - más permisivo para desarrollo
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Aumentado a 1000 requests
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Servir archivos estáticos
app.use('/uploads', express.static('public/uploads'));

// Skip rate limiting during development
if (process.env.NODE_ENV !== 'production') {
  console.log('⚠️ Rate limiting deshabilitado en modo desarrollo');
  // Opcional: aplicar solo a endpoints no críticos
  // app.use('/api/products', limiter);
} else {
  // En producción, aplicar rate limiting a todos
  app.use('/api/', limiter);
}

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check
app.get('/health', async (req, res) => {
  let dbStatus = 'ok';
  try { await sequelize.authenticate(); }
  catch (_) { dbStatus = 'error'; }

  const mem = process.memoryUsage();
  res.json({
    success: dbStatus === 'ok',
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    version: process.env.npm_package_version || '1.0.0',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: dbStatus,
    memory: {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes); // Movido arriba para que el GET público no sea atrapado por la protección de /api
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api', roleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/exchange-rates', exchangeRateRoutes);
app.use('/api/packaging-types', packagingTypeRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/presentation-types', presentationTypeRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/supplier-payments', supplierPaymentRoutes);
app.use('/api/credit-notes', creditNoteRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/price-lists', priceListRoutes);
app.use('/api/pos', posRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
