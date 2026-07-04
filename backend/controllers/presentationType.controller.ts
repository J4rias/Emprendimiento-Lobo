// Express type imports (ALWAYS at the top)
import { Request, Response, NextFunction } from 'express';

// Model imports (esModuleInterop — require with export = in the .ts files)
import PresentationType from '../models/PresentationType';

// ─── PATTERN B: module.exports = object ─────────────────────────────────────
// Original file uses: const controller = { async method(req, res) {} }
//                     module.exports = controller
// Convert to: same functions with types, and at the end:

const getActive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const presentationTypes = await PresentationType.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']],
      attributes: ['id', 'name', 'description']
    }) as any;

    res.json({
      data: presentationTypes
    });
  } catch (error) {
    next(error);
  }
};

export = {
  getActive
};