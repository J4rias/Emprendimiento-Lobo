import { Router, Request, Response } from 'express';
const logger = require('../config/logger');

const router = Router();

router.post('/', (req: Request, res: Response) => {
  const { message, stack, source, url, userAgent, extra } = req.body;

  if (!message) {
    return res.status(400).json({ message: 'message is required' });
  }

  logger.error('[CLIENT]', {
    message,
    stack: stack || null,
    source: source || 'unknown',
    url: url || null,
    userAgent: userAgent || null,
    ...(extra ? { extra } : {}),
  });

  res.json({ ok: true });
});

export = router;
