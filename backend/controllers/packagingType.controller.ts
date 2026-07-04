import { Request, Response, NextFunction } from 'express';

import PackagingType from '../models/PackagingType';

export const getActive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const packagingTypes = await PackagingType.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']] as [string, string][],
      attributes: ['id', 'name', 'description']
    }) as any[];

    res.json({
      data: packagingTypes
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getActive
};