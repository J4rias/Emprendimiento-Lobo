const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const logger = require('../config/logger');

// Usar memory storage para procesar después de tener acceso a req.body
const storage = multer.memoryStorage();

// Filtro para aceptar solo imágenes
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen'), false);
  }
};

// Configuración de multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB límite
    files: 5 // Máximo 5 archivos
  }
});

// Middleware para procesar imágenes con Sharp
const processImages = async (req, res, next) => {
  logger.info('processImages - req.file:', req.file ? 'exists' : 'undefined');
  logger.info('processImages - req.files:', req.files ? req.files.length : 'undefined');
  logger.info('processImages - req.body:', req.body);
  
  // Manejar tanto req.file (single) como req.files (multiple)
  const files = req.files || (req.file ? [req.file] : []);
  
  if (files.length === 0) {
    logger.info('processImages - No files found, skipping');
    return next();
  }

  try {
    const processedFiles = [];
    const type = req.body.type || 'temp';
    
    for (const file of files) {
      // Generar nombre único
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = file.fieldname + '-' + uniqueSuffix + '.jpg';
      
      // Crear directorio si no existe
      const uploadDir = path.join(__dirname, '../public/uploads', type);
      await fs.mkdir(uploadDir, { recursive: true });
      
      const outputPath = path.join(uploadDir, filename);
      
      // Configuración de redimensionamiento según el tipo
      let resizeOptions = {};
      let quality = 80;
      
      switch (type) {
        case 'brands':
          resizeOptions = { width: 400, height: 400, fit: 'inside' };
          quality = 85;
          break;
        case 'products':
          resizeOptions = { width: 600, height: 600, fit: 'inside' };
          quality = 80;
          break;
        case 'temp':
          resizeOptions = { width: 800, height: 600, fit: 'inside' };
          quality = 75;
          break;
        default:
          resizeOptions = { width: 600, height: 600, fit: 'inside' };
      }
      
      // Procesar imagen desde memoria con Sharp
      await sharp(file.buffer)
        .resize(resizeOptions)
        .jpeg({ quality, progressive: true })
        .toFile(outputPath);
      
      // Generar URL relativa
      const relativePath = path.relative(
        path.join(__dirname, '../public'),
        outputPath
      ).replace(/\\/g, '/');
      
      processedFiles.push({
        originalName: file.originalname,
        filename: filename,
        path: outputPath,
        url: '/' + relativePath,
        size: (await fs.stat(outputPath)).size
      });
    }
    
    req.processedFiles = processedFiles;
    next();
  } catch (error) {
    logger.error('Error procesando imágenes:', error);
    next(error);
  }
};

// Middleware para subir una sola imagen
const uploadSingle = (fieldName) => [
  upload.single(fieldName),
  processImages
];

// Middleware para subir múltiples imágenes
const uploadMultiple = (fieldName, maxCount = 5) => [
  upload.array(fieldName, maxCount),
  processImages
];

// Función para limpiar imágenes temporales
const cleanupTempImages = async () => {
  try {
    const tempDir = path.join(__dirname, '../public/uploads/temp');
    const files = await fs.readdir(tempDir);
    
    // Eliminar archivos más antiguos de 1 hora
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtime.getTime() < oneHourAgo) {
        await fs.unlink(filePath);
      }
    }
  } catch (error) {
    logger.error('Error limpiando imágenes temporales:', error);
  }
};

// Limpiar imágenes temporales cada hora
setInterval(cleanupTempImages, 60 * 60 * 1000);

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  processImages,
  cleanupTempImages
};
