import { Request, Response, NextFunction, Router } from 'express';

const paymentReceiptIntakeController = require('../controllers/paymentReceiptIntake.controller');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { upload, processImages } = require('../middleware/upload');
const multer = require('multer');

const router = Router();

// auth acepta X-API-Key (bot) o JWT; authorize exige el permiso bot-only
router.use(auth);

// El tipo de resize (receipts) se fija DESPUÉS de que multer parsea el multipart
// (que reemplaza req.body por completo) y ANTES de processImages, que lo lee.
const forzarTipoReceipts = (req: Request, _res: Response, next: NextFunction) => {
  req.body.type = 'receipts';
  next();
};

const manejarErrorMulter = (error: any, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError || error?.message === 'Solo se permiten archivos de imagen') {
    res.status(400).json({ message: error.message || 'Error al subir el archivo' });
    return;
  }
  next(error);
};

router.post(
  '/intake',
  authorize('payment_receipts.ingest'),
  upload.single('image'),
  manejarErrorMulter,
  forzarTipoReceipts,
  processImages,
  paymentReceiptIntakeController.create
);

export = router;
