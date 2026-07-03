const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const { uploadSingle, uploadMultiple } = require('../middleware/upload');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const multer = require('multer');
const logger = require('../config/logger');

// Todas las rutas requieren autenticación
router.use(auth);

// Manejador de errores de multer
const handleMulterError = (error, req, res, next) => {
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
router.post('/', authorize('products.update'), ...uploadSingle('image'), handleMulterError, (req, res) => {
  try {
    if (!req.processedFiles || req.processedFiles.length === 0) {
      return res.status(400).json({
        message: 'No se pudo procesar la imagen'
      });
    }

    const uploadedFile = req.processedFiles[0];

    res.json({
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
router.post('/multiple', authorize('products.update'), ...uploadMultiple('images', 5), handleMulterError, (req, res) => {
  try {
    if (!req.processedFiles || req.processedFiles.length === 0) {
      return res.status(400).json({
        message: 'No se pudieron procesar las imágenes'
      });
    }

    res.json({
      message: `${req.processedFiles.length} imágenes subidas exitosamente`,
      data: req.processedFiles.map(file => ({
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

// Eliminar una imagen
router.delete('/image', authorize('products.update'), async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        message: 'URL de la imagen requerida'
      });
    }

    const basePath = path.resolve(path.join(__dirname, '../public'));
    const imagePath = path.resolve(path.join(__dirname, '../public', url));

    if (!imagePath.startsWith(basePath + path.sep)) {
      return res.status(400).json({ message: 'Ruta de imagen inválida' });
    }

    try {
      await fs.unlink(imagePath);
      res.json({
        message: 'Imagen eliminada exitosamente'
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json({
          message: 'Imagen eliminada exitosamente'
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    logger.error('Error eliminando imagen:', error);
    res.status(500).json({
      message: 'Error al eliminar la imagen'
    });
  }
});

module.exports = router;
