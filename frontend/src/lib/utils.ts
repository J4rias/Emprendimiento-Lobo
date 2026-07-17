import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combina clases de Tailwind resolviendo conflictos correctamente.
 * Usar en todo componente de Phase 2+.
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-primary-700', className)
 * cn('text-sm text-red-500', className)  // className puede sobrescribir
 */
import type { ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
