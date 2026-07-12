import { Request, Response, NextFunction } from 'express';
import { User, Role } from '../models';

const jwt = require('jsonwebtoken');
const { jwt: jwtConfig, security } = require('../config/auth');

class AuthController {
  // Login
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;

      // Find user
      const user = (await User.findOne({
        where: { username },
        include: [{
          model: Role,
          as: 'role',
          include: ['permissions']
        }]
      })) as any;

      if (!user) {
        return res.status(401).json({
          message: 'Credenciales incorrectas'
        });
      }

      // Check if account is locked
      if (user.locked_until && user.locked_until > new Date()) {
        return res.status(401).json({
          message: 'Cuenta temporalmente bloqueada. Intente más tarde.'
        });
      }

      // Check if user is active
      if (!user.is_active) {
        return res.status(401).json({
          message: 'Cuenta inactiva. Contacte al administrador.'
        });
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        // Increment failed attempts
        user.failed_login_attempts += 1;

        // Lock account if max attempts reached
        if (user.failed_login_attempts >= security.maxLoginAttempts) {
          user.locked_until = new Date(Date.now() + security.lockoutTime);
          await user.save();

          return res.status(401).json({
            message: 'Cuenta bloqueada por múltiples intentos fallidos.'
          });
        }

        await user.save();

        return res.status(401).json({
          message: 'Credenciales incorrectas'
        });
      }

      // Reset failed attempts and update last login
      user.failed_login_attempts = 0;
      user.locked_until = null;
      user.last_login = new Date();
      await user.save();

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
      );

      // Send response
      res.json({
        message: 'Sesión iniciada',
        data: {
          user: user.toJSON(),
          token
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get current user
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (await User.findByPk((req as any).userId, {
        include: [{
          model: Role,
          as: 'role',
          include: ['permissions']
        }],
        attributes: { exclude: ['password'] }
      })) as any;

      res.json({
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  // Change password
  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { current_password: currentPassword, new_password: newPassword } = req.body;

      const user = (await User.findByPk((req as any).userId)) as any;

      // Verify current password
      const isPasswordValid = await user.comparePassword(currentPassword);

      if (!isPasswordValid) {
        return res.status(400).json({
          message: 'La contraseña actual es incorrecta'
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.json({
        message: 'Contraseña cambiada exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Logout (client-side token removal, but can log the event)
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      // Here you could add logic to blacklist the token
      // or log the logout event for audit purposes

      res.json({
        message: 'Sesión cerrada'
      });
    } catch (error) {
      next(error);
    }
  }
}

export = new AuthController();