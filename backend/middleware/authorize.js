const authorize = (...permissionNames) => {
  return (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({
          message: 'Authentication required.'
        });
      }

      // Get user permissions
      const userPermissions = req.user.role?.permissions || [];
      const userPermissionNames = userPermissions.map(p => p.name);

      // Check if user has required permissions
      const hasPermission = permissionNames.some(permission =>
        userPermissionNames.includes(permission)
      );

      if (!hasPermission) {
        return res.status(403).json({
          message: 'Insufficient permissions.',
          required: permissionNames,
          current: userPermissionNames
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        message: 'Authorization error.',
        error: error.message
      });
    }
  };
};

module.exports = authorize;
