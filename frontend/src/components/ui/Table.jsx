import { CaretUp, CaretDown, CaretUpDown } from '@phosphor-icons/react'
import { cn } from '../../lib/utils'
import { SkeletonTable } from './Skeleton'
import { EmptyState } from './EmptyState'

/** Ícono de ordenación para el encabezado */
function SortIcon({ col, sortBy, sortDir }) {
  const field = col.sortKey ?? (typeof col.accessor === 'string' ? col.accessor : null)
  if (!col.sortable || !field) return null
  if (sortBy !== field) return <CaretUpDown size={14} className="shrink-0 text-gray-400" />
  if (sortDir === 'asc')  return <CaretUp    size={14} className="shrink-0 text-primary-600" />
  return                         <CaretDown  size={14} className="shrink-0 text-primary-600" />
}

/**
 * Tabla de datos unificada — reemplaza DataTable y los <table> raw de las páginas.
 *
 * ── Columnas ──────────────────────────────────────────────────────────────────
 * Compatible con la API de DataTable existente:
 *   {
 *     key?:           string            — React key (opcional)
 *     header:         string|ReactNode  — texto del encabezado
 *     accessor?:      string|(row)=>any — cómo obtener el valor
 *     render?:        (value, row) => ReactNode  — renderer custom
 *     className?:     string            — clase extra en <th>
 *     cellClassName?: string            — clase extra en <td>
 *     sortable?:      boolean           — habilita click en header para ordenar
 *     sortKey?:       string            — campo enviado a onSort (default: accessor)
 *     wrap?:          boolean           — permite wrapping de texto en la celda
 *   }
 *
 * ── Ordenación (controlada — el padre maneja el estado) ─────────────────────
 *   const [sortBy, setSortBy] = useState('created_at')
 *   const [sortDir, setSortDir] = useState('desc')
 *
 *   <Table
 *     sortBy={sortBy}
 *     sortDir={sortDir}
 *     onSort={(field, dir) => { setSortBy(field); setSortDir(dir); setPage(1) }}
 *   />
 *
 * La ordenación persiste al cambiar de página porque el estado vive en el padre.
 *
 * ── Uso típico ────────────────────────────────────────────────────────────────
 *   <Table columns={cols} data={rows} loading={isLoading}
 *     emptyMessage="No hay pagos" emptyIcon={CreditCard}
 *     sortBy={sortBy} sortDir={sortDir} onSort={handleSort}
 *     rowClassName={(r) => r.cancelled ? 'opacity-50' : ''} />
 *   <Pagination page={page} totalPages={totalPages} ... />
 *
 * @param {Array}     columns
 * @param {Array}     data
 * @param {boolean}  [loading=false]
 * @param {number}   [skeletonRows=5]
 * @param {string}   [emptyMessage]
 * @param {string}   [emptyDescription]
 * @param {Component}[emptyIcon]           — icono Phosphor
 * @param {ReactNode}[emptyAction]
 * @param {function} [onRowClick]
 * @param {function|string} [rowClassName]
 * @param {string}   [sortBy]              — campo activo de ordenación
 * @param {'asc'|'desc'} [sortDir='asc']
 * @param {function} [onSort]              — (field, dir) => void
 * @param {string}   [className]
 */
export function Table({
  columns = [],
  data = [],
  loading = false,
  skeletonRows = 5,
  emptyMessage = 'No hay datos para mostrar',
  emptyDescription,
  emptyIcon,
  emptyAction,
  onRowClick,
  rowClassName,
  sortBy,
  sortDir = 'asc',
  onSort,
  className,
}) {
  const colCount = columns.length

  function handleSort(col) {
    if (!onSort || !col.sortable) return
    const field = col.sortKey ?? (typeof col.accessor === 'string' ? col.accessor : null)
    if (!field) return
    onSort(field, sortBy === field && sortDir === 'asc' ? 'desc' : 'asc')
  }

  function getAriaSortFor(col) {
    const field = col.sortKey ?? (typeof col.accessor === 'string' ? col.accessor : null)
    if (!col.sortable || !field || sortBy !== field) return undefined
    return sortDir === 'asc' ? 'ascending' : 'descending'
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="min-w-full">

        {/* ── Encabezado ──────────────────────────────────────── */}
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {columns.map((col, i) => {
              const sortable = col.sortable && !!onSort
              return (
                <th
                  key={col.key ?? i}
                  scope="col"
                  aria-sort={getAriaSortFor(col)}
                  onClick={() => handleSort(col)}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide select-none',
                    sortable && 'cursor-pointer hover:bg-gray-100 active:bg-gray-200 transition-colors',
                    col.className
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    <SortIcon col={col} sortBy={sortBy} sortDir={sortDir} />
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>

        {/* ── Cuerpo: cargando ────────────────────────────────── */}
        {loading ? (
          <SkeletonTable rows={skeletonRows} columns={colCount} />
        ) : (
          <tbody className="divide-y divide-gray-200 bg-white">

            {/* ── Cuerpo: sin datos ─────────────────────────── */}
            {data.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="py-2">
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyMessage}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (

              /* ── Cuerpo: filas ────────────────────────────── */
              data.map((row, rowIdx) => {
                const extraClass =
                  typeof rowClassName === 'function'
                    ? rowClassName(row)
                    : (rowClassName ?? '')

                return (
                  <tr
                    key={row.id ?? rowIdx}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-gray-50 active:bg-gray-100',
                      extraClass
                    )}
                  >
                    {columns.map((col, colIdx) => {
                      const value =
                        typeof col.accessor === 'function'
                          ? col.accessor(row)
                          : col.accessor
                          ? row[col.accessor]
                          : typeof col.key === 'string'
                          ? row[col.key]
                          : undefined

                      return (
                        <td
                          key={col.key ?? colIdx}
                          className={cn(
                            'px-4 py-3 text-sm text-gray-900',
                            !col.wrap && 'whitespace-nowrap',
                            col.cellClassName ?? col.className
                          )}
                        >
                          {col.render ? col.render(value, row) : value}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        )}
      </table>
    </div>
  )
}
