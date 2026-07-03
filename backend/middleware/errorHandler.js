const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(err.message || 'Unhandled error', {
    name: err.name,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
  });

  // Sequelize Validation Error
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      message: 'Validation error',
      errors: err.errors.map(e => ({
        field: e.path,
        message: e.message
      }))
    });
  }

  // Sequelize Unique Constraint Error
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      message: 'Duplicate entry',
      errors: err.errors.map(e => ({
        field: e.path,
        message: `${e.path} already exists`
      }))
    });
  }

  // Sequelize Foreign Key Constraint Error
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      message: 'Invalid reference',
      error: 'The referenced record does not exist'
    });
  }

  // Sequelize Database Error
  if (err.name === 'SequelizeDatabaseError') {
    return res.status(500).json({
      message: 'Database error',
      error: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
    });
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Token expired'
    });
  }

  // body-parser JSON malformado — evita exponer stack trace al cliente
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      message: 'JSON inválido en el cuerpo de la solicitud'
    });
  }

  // Default Error — no exponer err.message ni stack en producción
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.statusCode || 500).json({
    message: isProd ? 'Internal server error' : (err.message || 'Internal server error')
  });
};

module.exports = errorHandler;
