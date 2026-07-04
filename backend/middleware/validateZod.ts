import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Middleware factory: validates req.body against a Zod schema.
 * On success, replaces req.body with the parsed (coerced) value.
 * On failure, returns 400 with structured field errors.
 *
 * Usage:
 *   router.post('/foo', validateZod(MySchema), controller);
 */
const validateZod = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      res.status(400).json({ message: 'Validation failed', errors });
      return;
    }
    req.body = result.data;
    next();
  };
};

export = validateZod;
