const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');
const { jwt: jwtConfig, security } = require('../config/auth');

class AuthController {
  // Login
  async login(req, res, next) {
    try {
      const { username, password } = req.body;

      // Find user
      const user = await User.findOne({
        where: { username },
        include: [{
          model: Role,
          as: 'role',
          include: ['permissions']
        }]
      });

      if (!user) {
        return res.status(401).json({
          message: 'Invalid credentials'
        });
      }

      // Check if account is locked
      if (user.locked_until && user.locked_until > new Date()) {
        return res.status(401).json({
          message: 'Account is temporarily locked. Please try again later.'
        });
      }

      // Check if user is active
      if (!user.is_active) {
        return res.status(401).json({
          message: 'Account is inactive. Please contact administrator.'
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
            message: 'Account locked due to multiple failed login attempts.'
          });
        }

        await user.save();

        return res.status(401).json({
          message: 'Invalid credentials'
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
        message: 'Login successful',
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
  async me(req, res, next) {
    try {
      const user = await User.findByPk(req.userId, {
        include: [{
          model: Role,
          as: 'role',
          include: ['permissions']
        }],
        attributes: { exclude: ['password'] }
      });

      res.json({
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  // Change password
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await User.findByPk(req.userId);

      // Verify current password
      const isPasswordValid = await user.comparePassword(currentPassword);

      if (!isPasswordValid) {
        return res.status(400).json({
          message: 'Current password is incorrect'
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.json({
        message: 'Password changed successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Logout (client-side token removal, but can log the event)
  async logout(req, res, next) {
    try {
      // Here you could add logic to blacklist the token
      // or log the logout event for audit purposes

      res.json({
        message: 'Logout successful'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
