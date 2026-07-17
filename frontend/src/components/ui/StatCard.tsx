import React from 'react'
import { cn } from '../../lib/utils'

/**
 * StatCard — tile de métrica para KPI rows.
 *
 * Contrato (ver dataviz): label en sentence case sin dos puntos, valor grande
 * semibold con cifras proporcionales, detalle secundario opcional. El color lo
 * lleva solo el icono (tono semántico); el texto usa la tinta estándar.
 *
 * @param {string}  label     - Nombre de la métrica ("Ventas del día")
 * @param {node}    value     - Valor principal (string o nodo)
 * @param {node}    [detail]  - Línea secundaria (desglose, período de referencia)
 * @param {elementType} [icon]  - Ícono Phosphor
 * @param {string}  [tone]    - primary | success | warning | error | neutral (solo tiñe el ícono)
 * @param {function}[onClick] - Hace el tile clickeable (navegación)
 */

type Tone = 'primary' | 'success' | 'warning' | 'error' | 'neutral'

const TONES: Record<Tone, string> = {
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-green-50 text-green-600',
  warning: 'bg-yellow-50 text-yellow-600',
  error:   'bg-red-50 text-red-600',
  neutral: 'bg-gray-100 text-gray-600',
}

interface StatCardProps {
  label: string
  value?: React.ReactNode
  detail?: React.ReactNode
  icon?: React.ComponentType<any>
  tone?: Tone
  onClick?: () => void
  className?: string
  children?: React.ReactNode
}

export function StatCard({ label, value, detail, icon: Icon, tone = 'primary', onClick, className, children }: StatCardProps) {
  const Wrapper: React.ElementType = onClick ? 'button' : 'div'
  return (
    <Wrapper
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={cn(
        'rounded-lg border border-gray-200 bg-white p-4 shadow-sm text-left w-full',
        onClick && 'hover:shadow-md hover:border-gray-300 transition-all cursor-pointer',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          {value !== undefined && (
            <p className={cn(
              'font-semibold text-gray-900 mt-1',
              // Montos largos (COP) bajan un paso de tamaño en vez de truncarse
              String(value).length > 12 ? 'text-xl' : 'text-2xl'
            )}>{value}</p>
          )}
          {children}
          {detail && (
            <div className="text-xs text-gray-500 mt-1">{detail}</div>
          )}
        </div>
        {Icon && (
          <div className={cn('p-2.5 rounded-lg shrink-0', TONES[tone] || TONES.primary)}>
            <Icon className="w-5 h-5" weight="duotone" />
          </div>
        )}
      </div>
    </Wrapper>
  )
}
