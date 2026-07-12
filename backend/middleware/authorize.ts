import { Request, Response, NextFunction } from 'express';

const authorize = (...permissionNames: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ message: 'Authentication required.' });
        return;
      }

      const userPermissions: { name: string }[] = user.role?.permissions || [];
      const userPermissionNames = userPermissions.map(p => p.name);

      const hasPermission = permissionNames.some(permission =>
        userPermissionNames.includes(permission)
      );

      if (!hasPermission) {
        res.status(403).json({
          message: 'Insufficient permissions.',
          required: permissionNames,
          current: userPermissionNames
        });
        return;
      }

      next();
    } catch (error: any) {
      res.status(500).json({ message: 'Authorization error.', error: error.message });
    }
  };
};

export = authorize;
