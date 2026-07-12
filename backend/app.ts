import express from 'express';
const cors = require('cors');
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
require('dotenv').config();

import { Request, Response } from 'express';

const errorHandler = require('./middleware/errorHandler');
const { sequelize } = require('./config/database');
const logger = require('./config/logger');

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
const arRoutes = require('./routes/ar.routes');
const preOrderRoutes = require('./routes/preOrder.routes');
const auditLogRoutes = require('./routes/auditLog.routes');

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
  ...(process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s: any) => s.trim()).filter(Boolean)
    : []),
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin: any, callback: any) => {
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
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '0') || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '0') || 1000, // Aumentado a 1000 requests
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
  logger.debug('Rate limiting deshabilitado en modo desarrollo');
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

// HTTP Logging via Morgan → Winston
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined', {
  stream: (logger as any).stream,
}));

// Health check
app.get('/health', async (req: Request, res: Response) => {
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
app.use('/api/catalog', require('./routes/catalog.routes'));
app.use('/api/company', companyRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/upload', uploadRoutes);   // legacy mount
app.use('/api/uploads', uploadRoutes);  // new normalized path
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
app.use('/api/accounts-receivable', arRoutes);
app.use('/api/pre-orders', preOrderRoutes);
app.use('/api/banks', require('./routes/bank.routes'));
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/docs', require('./routes/docs.routes'));

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    message: 'Endpoint not found'
  });
});

// Error handler (must be last)
app.use(errorHandler);

export = app;
