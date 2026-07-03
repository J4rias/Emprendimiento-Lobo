import { cn } from '../../lib/utils'

export function Card({ className, variant = 'default', children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-white',
        variant === 'default' && 'p-6 shadow-sm',
        variant === 'compact' && 'p-4 shadow-sm',
        variant === 'flat' && 'p-4',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div
      className={cn('flex items-center justify-between pb-4 mb-4 border-b border-gray-200', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardContent({ className, children, ...props }) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...props }) {
  return (
    <div
      className={cn('flex items-center justify-end gap-3 pt-4 mt-4 border-t border-gray-200', className)}
      {...props}
    >
      {children}
    </div>
  )
}
