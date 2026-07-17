import React, { useEffect, useState } from 'react'
import {
  CheckCircle,
  Warning,
  XCircle,
  Info,
  X,
} from '@phosphor-icons/react'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const alertVariants = cva(
  'relative flex items-start gap-3 rounded-md border-l-4 p-3 text-sm',
  {
    variants: {
      variant: {
        error:   'bg-red-50 border-red-500 text-red-800',
        warning: 'bg-amber-50 border-amber-500 text-amber-800',
        success: 'bg-green-50 border-green-500 text-green-800',
        info:    'bg-blue-50 border-blue-500 text-blue-800',
      },
    },
    defaultVariants: { variant: 'info' },
  }
)

type AlertVariant = 'error' | 'warning' | 'success' | 'info'

const icons: Record<AlertVariant, React.ComponentType<any>> = {
  error:   XCircle,
  warning: Warning,
  success: CheckCircle,
  info:    Info,
}

const iconColors: Record<AlertVariant, string> = {
  error:   'text-red-500',
  warning: 'text-amber-500',
  success: 'text-green-500',
  info:    'text-blue-500',
}

interface AlertProps {
  variant?: AlertVariant
  title?: string
  description?: string
  action?: React.ReactNode
  dismissible?: boolean
  autoClose?: number
  className?: string
  children?: React.ReactNode
}

export function Alert({
  variant = 'info',
  title,
  description,
  action,
  dismissible = false,
  autoClose,
  className,
  children,
}: AlertProps) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!autoClose) return
    const timer = setTimeout(() => setDismissed(true), autoClose)
    return () => clearTimeout(timer)
  }, [autoClose])

  if (dismissed) return null

  const Icon = icons[variant]

  return (
    <div className={cn(alertVariants({ variant }), className)} role="alert">
      <Icon size={16} weight="bold" className={cn('mt-0.5 shrink-0', iconColors[variant])} />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold leading-snug">{title}</p>}
        {description && (
          <p className={cn('leading-snug', title ? 'mt-0.5 opacity-90' : '')}>{description}</p>
        )}
        {children}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 -mt-0.5 -mr-0.5 p-2 rounded-md opacity-60 hover:opacity-100 active:opacity-100 active:bg-black/10 transition-opacity"
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
