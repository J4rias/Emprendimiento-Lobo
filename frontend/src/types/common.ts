/** Paginación estándar del backend */
export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Respuesta genérica del API con paginación */
export interface ListResponse<T> {
  data: T[];
  pagination: Pagination;
}

/** Respuesta genérica del API para un solo recurso */
export interface ApiResponse<T> {
  message: string;
  data: T;
}
