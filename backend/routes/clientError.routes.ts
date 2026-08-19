import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
const logger = require('../config/logger');

const router = Router();

// Sumidero de errores del navegador: sin auth a propósito (un fallo de login
// también debe poder reportarse). Por eso lleva su propio límite, mucho más
// estrecho que el global de /api/, y recorta lo que escribe en el log.
const clientErrorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: 'Demasiados reportes de error desde esta IP' },
  standardHeaders: true,
  legacyHeaders: false,
});

const clip = (value: unknown, max: number): string | null =>
  typeof value === 'string' ? value.slice(0, max) : null;

router.post('/', clientErrorLimiter, (req: Request, res: Response) => {
  const { message, stack, source, url, userAgent, extra } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ message: 'message is required' });
  }

  logger.error('[CLIENT]', {
    message:   message.slice(0, 500),
    stack:     clip(stack, 4000),
    source:    clip(source, 100) || 'unknown',
    url:       clip(url, 500),
    userAgent: clip(userAgent, 300),
    // Anidado, no esparcido: así no puede sobrescribir claves del log
    ...(extra ? { extra: JSON.stringify(extra).slice(0, 2000) } : {}),
  });

  res.json({ ok: true });
});

export = router;
