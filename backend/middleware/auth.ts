import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { auditStorage } from './auditContext';
const { jwt: jwtConfig } = require('../config/auth');
const { User, Role } = require('../models');

const BOT_PERMISSIONS = [
  'products.view', 'categories.view', 'price_lists.view',
  'exchange_rates.view', 'customers.view', 'customers.create',
  'pre_orders.create', 'pre_orders.view',
  'sales.view', 'inventory.view', 'ar.view',
];

const auth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Check for bot API key before JWT
    const apiKey = req.header('X-API-Key');
    if (apiKey) {
      const expected = process.env.BOT_API_KEY;
      if (!expected) {
        res.status(401).json({ message: 'API key auth not configured.' });
        return;
      }
      const keyBuf = Buffer.from(apiKey);
      const expectedBuf = Buffer.from(expected);
      if (keyBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(keyBuf, expectedBuf)) {
        res.status(401).json({ message: 'Invalid API key.' });
        return;
      }
      (req as any).user = {
        id: 0,
        username: 'atlas-bot',
        first_name: 'Atlas',
        last_name: 'Bot',
        role: {
          name: 'bot',
          permissions: BOT_PERMISSIONS.map(name => ({ name })),
        },
      };
      (req as any).userId = 0;
      return auditStorage.run({ userId: 0, ip: req.ip || '' }, next);
    }

    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ message: 'No token provided. Authentication required.' });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, jwtConfig.secret) as { id: number };

    // Find user
    const user = await User.findByPk(decoded.id, {
      include: [{
        model: Role,
        as: 'role',
        include: ['permissions']
      }],
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      res.status(401).json({ message: 'User not found.' });
      return;
    }

    if (!(user as any).is_active) {
      res.status(401).json({ message: 'User account is inactive.' });
      return;
    }

    // Check if account is locked
    if ((user as any).locked_until && (user as any).locked_until > new Date()) {
      res.status(401).json({ message: 'Account is temporarily locked. Please try again later.' });
      return;
    }

    // Attach user to request
    (req as any).user = user;
    (req as any).userId = (user as any).id;

    auditStorage.run({ userId: (user as any).id, ip: req.ip || '' }, next);
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ message: 'Invalid token.' });
      return;
    }
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ message: 'Token expired.' });
      return;
    }
    res.status(500).json({ message: 'Authentication error.', error: error.message });
  }
};

export = auth;
