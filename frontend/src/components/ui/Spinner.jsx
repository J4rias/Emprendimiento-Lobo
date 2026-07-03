import { cn } from '../../lib/utils'

const sizes = {
  sm: 'h-3.5 w-3.5 border-[1.5px]',
  md: 'h-[18px] w-[18px] border-2',
  lg: 'h-6 w-6 border-2',
}

export function Spinner({ size = 'md', className }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full border-gray-200 border-t-primary-600 animate-spin',
        sizes[size],
        className
      )}
      role="status"
      aria-label="Cargando"
    />
  )
}
