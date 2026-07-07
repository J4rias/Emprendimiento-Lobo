require('dotenv').config();

export = {
  jwt: {
    secret: (process.env.JWT_SECRET || 'your-secret-key-change-in-production') as any,
    expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as any,
    refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any
  },
  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS as any) || 10
  },
  security: {
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS as any) || 5,
    lockoutTime: parseInt(process.env.LOCKOUT_TIME as any) || 900000 // 15 minutos en ms
  }
};
