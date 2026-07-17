import { ArrowCounterClockwise } from '@phosphor-icons/react'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { localToday, toLocalDateStr } from '../../utils/dateUtils'

/**
 * Calcula el rango de fechas por defecto.
 *
 * @param {number} [defaultDays] - Si se provee, rango = últimos N días.
 *                                 Si no, rango = mes en curso (día 1 → hoy).
 * @returns {{ start_date: string, end_date: string }}
 */
export function getDefaultDateRange(defaultDays) {
  const today = new Date()
  const end_date = localToday()

  if (defaultDays) {
    const start = new Date(today)
    start.setDate(start.getDate() - defaultDays + 1)
    return { start_date: toLocalDateStr(start), end_date }
  }

  // Mes en curso: primer día del mes hasta hoy
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  return { start_date: `${year}-${month}-01`, end_date }
}

function getPrevMonthRange() {
  const today = new Date()
  const lastOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0)
  const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1)
  return {
    start_date: toLocalDateStr(firstOfPrevMonth),
    end_date: toLocalDateStr(lastOfPrevMonth),
  }
}

const PRESETS = [
  { label: 'Hoy',          resolve: () => getDefaultDateRange(1) },
  { label: '7 días',       resolve: () => getDefaultDateRange(7) },
  { label: '30 días',      resolve: () => getDefaultDateRange(30) },
  { label: 'Este mes',     resolve: () => getDefaultDateRange() },
  { label: 'Mes anterior', resolve: () => getPrevMonthRange() },
]

const inputClass = cn(
  'h-9 px-3 text-sm rounded-md border border-gray-300 bg-white transition-colors',
  'focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500'
)

/**
 * Selector de rango de fechas controlado y reutilizable.
 *
 * @param {string}   startDate          - Fecha de inicio controlada (YYYY-MM-DD)
 * @param {string}   endDate            - Fecha de fin controlada (YYYY-MM-DD)
 * @param {function} onChange           - Callback recibe { start_date, end_date }
 * @param {number}  [defaultDays]       - Si se provee, el default es "últimos N días";
 *                                        si no, es "mes en curso"
 * @param {boolean} [showPresets=false] - Muestra chips de acceso rápido
 * @param {string}  [className]
 *
 * Uso típico en la página:
 *   const [filters, setFilters] = useState({
 *     ...getDefaultDateRange(),   // o getDefaultDateRange(30) para últimos 30 días
 *     otroFiltro: '',
 *   })
 *
 *   <DateRangeFilter
 *     startDate={filters.start_date}
 *     endDate={filters.end_date}
 *     onChange={({ start_date, end_date }) => {
 *       setFilters(prev => ({ ...prev, start_date, end_date }))
 *       setPage(1)
 *     }}
 *   />
 */
export function DateRangeFilter({
  startDate,
  endDate,
  onChange,
  defaultDays,
  showPresets = false,
  className,
}) {
  const defaults = getDefaultDateRange(defaultDays)
  const isDefault = startDate === defaults.start_date && endDate === defaults.end_date

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {showPresets && (
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(preset.resolve())}
              className="rounded-full border border-gray-300 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50"
            >
              {preset.label}
            </Button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
          <input
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => onChange({ start_date: e.target.value, end_date: endDate })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => onChange({ start_date: startDate, end_date: e.target.value })}
            className={inputClass}
          />
        </div>

        {!isDefault && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(getDefaultDateRange(defaultDays))}
            title="Restaurar rango por defecto"
          >
            <ArrowCounterClockwise size={15} />
          </Button>
        )}
      </div>
    </div>
  )
}
