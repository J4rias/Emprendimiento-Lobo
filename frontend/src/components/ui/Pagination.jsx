import { useCallback, useState } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { cn } from '../../lib/utils'

const STORAGE_KEY = 'atlas_table_limit'
const LIMIT_OPTIONS = [25, 50, 100]
const DEFAULT_LIMIT = 25

/**
 * Hook para manejar el límite de filas por página con persistencia en localStorage.
 * El valor elegido por el usuario se recuerda entre sesiones y entre páginas.
 *
 * @param {number} [defaultValue=25] - Valor por defecto si no hay nada guardado
 * @returns {[number, function]} [limit, setLimit]
 *
 * Uso:
 *   const [limit, setLimit] = useTableLimit()
 *
 *   <Pagination
 *     limit={limit}
 *     onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1) }}
 *     ...
 *   />
 */
export function useTableLimit(defaultValue = DEFAULT_LIMIT) {
  const [limit, setLimitState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed = saved ? Number(saved) : NaN
      return LIMIT_OPTIONS.includes(parsed) ? parsed : defaultValue
    } catch {
      return defaultValue
    }
  })

  const setLimit = useCallback((newLimit) => {
    setLimitState(newLimit)
    try {
      localStorage.setItem(STORAGE_KEY, String(newLimit))
    } catch {}
  }, [])

  return [limit, setLimit]
}

function getPageNumbers(page, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages = [1]
  if (page > 3) pages.push('...')

  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  if (page < totalPages - 2) pages.push('...')
  if (totalPages > 1) pages.push(totalPages)

  return pages
}

/**
 * Paginación con selector de filas por página.
 * El selector solo se muestra cuando se pasa `onLimitChange`.
 * Para persistencia automática del límite, usar junto con `useTableLimit`.
 *
 * @param {number}   page
 * @param {number}   totalPages
 * @param {number}   total            — total de registros
 * @param {number}  [limit=25]        — registros por página
 * @param {function} onPageChange
 * @param {function} [onLimitChange]  — si se omite, no se muestra el selector
 */
export function Pagination({ page, totalPages, total, limit = DEFAULT_LIMIT, onPageChange, onLimitChange }) {
  if (!totalPages || totalPages <= 0) return null

  const start = total === 0 ? 0 : (page - 1) * limit + 1
  const end = Math.min(page * limit, total)
  const pageNumbers = getPageNumbers(page, totalPages)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 text-sm">
      {/* Contador */}
      <p className="text-gray-500 shrink-0">
        Mostrando <span className="font-medium text-gray-700">{start}–{end}</span> de{' '}
        <span className="font-medium text-gray-700">{total}</span> registros
      </p>

      {/* Botones de página */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={cn(
            'flex items-center gap-1 px-3 h-10 rounded-md text-sm font-medium transition-colors',
            'text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          <CaretLeft size={14} />
          <span className="hidden sm:inline">Anterior</span>
        </button>

        {pageNumbers.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-gray-400 select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                'h-10 w-10 rounded-md text-sm font-medium transition-colors',
                p === page
                  ? 'bg-primary-600 text-white active:bg-primary-800'
                  : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200'
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={cn(
            'flex items-center gap-1 px-3 h-10 rounded-md text-sm font-medium transition-colors',
            'text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          <span className="hidden sm:inline">Siguiente</span>
          <CaretRight size={14} />
        </button>
      </div>

      {/* Selector por página */}
      {onLimitChange && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-gray-500 hidden md:inline">Por página:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="h-10 pl-3 pr-7 text-sm rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500 appearance-none"
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
