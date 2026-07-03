const express = require('express');
const router = express.Router();
const { uploadSingle, uploadMultiple } = require('../middleware/upload');
const auth = require('../middleware/auth');
const multer = require('multer');

// Todas las rutas requieren autenticación
router.use(auth);

// Manejador de errores de multer
const handleMulterError = (error, req, res, next) => {
  logger.info('Multer error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'El archivo es demasiado grande. Máximo 5MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Demasiados archivos. Máximo 5'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Campo de archivo inesperado'
      });
    }
  }
  
  if (error.message === 'Solo se permiten archivos de imagen') {
    return res.status(400).json({
      success: false,
      message: 'Solo se permiten archivos de imagen'
    });
  }
  
  res.status(400).json({
    success: false,
    message: error.message || 'Error al subir el archivo'
  });
};

// Subir una sola imagen
router.post('/', (req, res, next) => {
  logger.info('Upload route hit');
  next();
}, ...uploadSingle('image'), handleMulterError, (req, res) => {
  try {
    if (!req.processedFiles || req.processedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se pudo procesar la imagen'
      });
    }

    const uploadedFile = req.processedFiles[0];
    
    logger.info('Upload successful - response:', {
      url: uploadedFile.url,
      filename: uploadedFile.filename,
      originalName: uploadedFile.originalName,
      size: uploadedFile.size
    });
    
    res.json({
      success: true,
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
      success: false,
      message: 'Error al subir la imagen',
      error: error.message
    });
  }
});

// Subir múltiples imágenes
router.post('/multiple', ...uploadMultiple('images', 5), handleMulterError, (req, res) => {
  try {
    if (!req.processedFiles || req.processedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se pudieron procesar las imágenes'
      });
    }

    res.json({
      success: true,
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
      success: false,
      message: 'Error al subir las imágenes',
      error: error.message
    });
  }
});

// Eliminar una imagen
router.delete('/image', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL de la imagen requerida'
      });
    }

    // Construir ruta completa
    const fs = require('fs').promises;
    const path = require('path');
const logger = require('../config/logger');
    const imagePath = path.join(__dirname, '../public', url);
    
    // Verificar si el archivo existe y eliminarlo
    try {
      await fs.unlink(imagePath);
      res.json({
        success: true,
        message: 'Imagen eliminada exitosamente'
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        // El archivo no existe, pero consideramos exitosa la operación
        res.json({
          success: true,
          message: 'Imagen eliminada exitosamente'
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    logger.error('Error eliminando imagen:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la imagen',
      error: error.message
    });
  }
});

module.exports = router;
