import { Router, Request, Response, NextFunction } from 'express';
const fs = require('fs').promises;
const path = require('path');
const router = Router();
const { uploadSingle, uploadMultiple } = require('../middleware/upload');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const multer = require('multer');
const logger = require('../config/logger');

// Todas las rutas requieren autenticación
router.use(auth);

// Manejador de errores de multer
const handleMulterError = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'El archivo es demasiado grande. Máximo 5MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        message: 'Demasiados archivos. Máximo 5'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        message: 'Campo de archivo inesperado'
      });
    }
  }

  if (error.message === 'Solo se permiten archivos de imagen') {
    return res.status(400).json({
      message: 'Solo se permiten archivos de imagen'
    });
  }

  res.status(400).json({
    message: error.message || 'Error al subir el archivo'
  });
};

// Subir una sola imagen
router.post('/', authorize('products.update'), ...uploadSingle('image'), handleMulterError, (req: Request, res: Response) => {
  try {
    if (!(req as any).processedFiles || (req as any).processedFiles.length === 0) {
      return res.status(400).json({
        message: 'No se pudo procesar la imagen'
      });
    }

    const uploadedFile = (req as any).processedFiles[0];

    res.status(201).json({
      message: 'Imagen subida exitosamente',
      data: {
        url: uploadedFile.url,
        filename: uploadedFile.filename,
        originalName: uploadedFile.originalName,
        size: uploadedFile.size
      }
    });
  } catch (error) {
    logger.error('Error en upload:', error);
    res.status(500).json({
      message: 'Error al subir la imagen'
    });
  }
});

// Subir múltiples imágenes
router.post('/multiple', authorize('products.update'), ...uploadMultiple('images', 5), handleMulterError, (req: Request, res: Response) => {
  try {
    if (!(req as any).processedFiles || (req as any).processedFiles.length === 0) {
      return res.status(400).json({
        message: 'No se pudieron procesar las imágenes'
      });
    }

    res.status(201).json({
      message: `${(req as any).processedFiles.length} imágenes subidas exitosamente`,
      data: (req as any).processedFiles.map((file: any) => ({
        url: file.url,
        filename: file.filename,
        originalName: file.originalName,
        size: file.size
      }))
    });
  } catch (error) {
    logger.error('Error en upload multiple:', error);
    res.status(500).json({
      message: 'Error al subir las imágenes'
    });
  }
});

// Delete image by filename (new normalized endpoint — mounted via /api/uploads/:filename)
router.delete('/:filename', authorize('products.update'), async (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;

    // Only allow safe filename characters (no path traversal)
    if (!/^[\w\-. ]+$/.test(filename)) {
      return res.status(400).json({ message: 'Nombre de archivo inválido' });
    }

    const basePath = path.resolve(path.join(__dirname, '../public/uploads'));
    const filePath = path.resolve(path.join(__dirname, '../public/uploads', filename));

    if (!filePath.startsWith(basePath + path.sep)) {
      return res.status(400).json({ message: 'Ruta de archivo inválida' });
    }

    try {
      await fs.unlink(filePath);
      res.json({ message: 'Imagen eliminada exitosamente' });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        res.json({ message: 'Imagen eliminada exitosamente' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    logger.error('Error eliminando imagen por filename:', error);
    res.status(500).json({ message: 'Error al eliminar la imagen' });
  }
});

export = router;
