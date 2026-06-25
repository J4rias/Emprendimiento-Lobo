const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config/auth');
const { User, Role } = require('../models');

const BOT_PERMISSIONS = [
  'products.view', 'categories.view', 'price_lists.view',
  'exchange_rates.view', 'customers.view', 'customers.create',
  'pre_orders.create', 'pre_orders.view',
  'sales.view', 'inventory.view', 'ar.view',
];

const auth = async (req, res, next) => {
  try {
    // Check for bot API key before JWT
    const apiKey = req.header('X-API-Key');
    if (apiKey) {
      const expected = process.env.BOT_API_KEY;
      if (!expected) {
        return res.status(401).json({ success: false, message: 'API key auth not configured.' });
      }
      const keyBuf = Buffer.from(apiKey);
      const expectedBuf = Buffer.from(expected);
      if (keyBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(keyBuf, expectedBuf)) {
        return res.status(401).json({ success: false, message: 'Invalid API key.' });
      }
      req.user = {
        id: 0,
        username: 'atlas-bot',
        first_name: 'Atlas',
        last_name: 'Bot',
        role: {
          name: 'bot',
          permissions: BOT_PERMISSIONS.map(name => ({ name })),
        },
      };
      req.userId = 0;
      return next();
    }

    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authentication required.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, jwtConfig.secret);

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
      return res.status(401).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive.'
      });
    }

    // Check if account is locked
    if (user.locked_until && user.locked_until > new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Account is temporarily locked. Please try again later.'
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Authentication error.',
      error: error.message
    });
  }
};

module.exports = auth;
