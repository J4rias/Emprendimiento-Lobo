import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

/**
 * Input de búsqueda con icono, debounce interno y botón de limpiar.
 *
 * Encapsula el patrón repetido en todas las páginas:
 *   const [search, setSearch] = useState('')
 *   const [debouncedSearch, setDebouncedSearch] = useState('')
 *   useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(t) }, [search])
 *
 * Con este componente la página solo necesita UN estado (el valor debounced):
 *   const [search, setSearch] = useState('')
 *   <SearchInput onChange={setSearch} placeholder="..." />
 *
 * @param {string}   value              - Valor comprometido (debounced). Permite reset externo.
 * @param {function} onChange           - (debouncedValue: string) => void
 * @param {string}  [placeholder]       - Placeholder del input. Default: "Buscar..."
 * @param {number}  [debounce=300]      - Delay en ms. Pasar 0 para sin debounce.
 * @param {string}  [className]         - Clase extra para el contenedor (e.g. "w-64")
 *
 * Reset externo ("Limpiar filtros"):
 *   Cuando el padre actualiza `value` a '' desde afuera (no desde el propio callback),
 *   el componente sincroniza el display sin disparar onChange de nuevo.
 */
export function SearchInput({
  value = '',
  onChange,
  placeholder = 'Buscar...',
  debounce: delay = 300,
  className,
}) {
  const [localValue, setLocalValue] = useState(value)
  const mounted = useRef(false)
  const skipDebounce = useRef(false)
  const lastEmitted = useRef(value)

  // Sync display cuando el padre resetea value externamente
  // (ej: botón "Limpiar filtros" que hace setSearch(''))
  useEffect(() => {
    if (value !== lastEmitted.current) {
      skipDebounce.current = true
      setLocalValue(value)
      lastEmitted.current = value
    }
  }, [value])

  // Debounce: llama onChange después de que el usuario deja de escribir
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    if (skipDebounce.current) {
      skipDebounce.current = false
      return
    }
    if (delay === 0) {
      onChange?.(localValue)
      lastEmitted.current = localValue
      return
    }
    const timer = setTimeout(() => {
      onChange?.(localValue)
      lastEmitted.current = localValue
    }, delay)
    return () => clearTimeout(timer)
  }, [localValue])  

  const handleClear = () => {
    setLocalValue('')
    onChange?.('')
    lastEmitted.current = ''
  }

  return (
    <div className={cn('relative', className)}>
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
      <input
        type="text"
        inputMode="search"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full h-9 pl-9 text-sm rounded-md border border-gray-300 bg-white transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500 placeholder-gray-400',
          localValue ? 'pr-9' : 'pr-3'
        )}
      />
      {localValue && (
        // size="icon" → h-9 w-9 (36px): mismo alto que el input, mayor área táctil
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClear}
          className="absolute right-0 top-0 h-full rounded-l-none text-gray-400 hover:text-gray-600 active:bg-gray-100"
        >
          <X size={15} />
        </Button>
      )}
    </div>
  )
}
