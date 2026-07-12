import { Response } from 'express';

export interface Pagination {
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * 200 OK — recurso único o resultado de acción.
 * Reemplaza: res.json({ success: true, data, message })
 */
export function ok(res: Response, data: unknown, message = 'OK'): Response {
  return res.json({ message, data });
}

/**
 * 201 Created — recurso creado.
 * Reemplaza: res.status(201).json({ success: true, data, message })
 */
export function created(res: Response, data: unknown, message = 'Creado exitosamente'): Response {
  return res.status(201).json({ message, data });
}

/**
 * 200 OK — lista paginada.
 * Reemplaza: res.json({ success: true, data: [...], total, totalPages, ... })
 */
export function paginated(res: Response, data: unknown[], pagination: Pagination): Response {
  return res.json({ data, pagination });
}

/**
 * 204 No Content — acción completada sin body.
 */
export function noContent(res: Response): Response {
  return res.status(204).send();
}

/**
 * 4xx/5xx Error.
 * Reemplaza: res.status(N).json({ success: false, message, error: ... })
 */
export function fail(
  res: Response,
  status: number,
  message: string,
  errors?: ValidationError[],
): Response {
  const body: { message: string; errors?: ValidationError[] } = { message };
  if (errors && errors.length > 0) body.errors = errors;
  return res.status(status).json(body);
}
