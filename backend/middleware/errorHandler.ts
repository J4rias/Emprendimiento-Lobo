import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): Response | void => {
  logger.error(err.message || 'Unhandled error', {
    name: err.name,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
  });

  // Sequelize Validation Error
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      message: 'Error de validación',
      errors: err.errors.map((e: any) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  // Sequelize Unique Constraint Error
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      message: 'Ya existe un registro con ese valor',
      errors: err.errors.map((e: any) => ({
        field: e.path,
        message: `El campo ${e.path} ya existe`,
      })),
    });
  }

  // Sequelize Foreign Key Constraint Error
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      message: 'Referencia inválida — el registro relacionado no existe',
    });
  }

  // Sequelize Database Error
  if (err.name === 'SequelizeDatabaseError') {
    return res.status(500).json({
      message: 'Error de base de datos',
    });
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Token inválido',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Token expirado',
    });
  }

  // body-parser JSON malformado — evita exponer stack trace al cliente
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    return res.status(400).json({
      message: 'JSON inválido en el cuerpo de la solicitud',
    });
  }

  // Default Error — no exponer err.message ni stack en producción
  const isProd = process.env.NODE_ENV === 'production';
  return res.status(err.statusCode || 500).json({
    message: isProd ? 'Error interno del servidor' : (err.message || 'Error interno del servidor'),
  });
};

export = errorHandler;
