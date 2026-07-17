import React from 'react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        neutral: 'bg-slate-100 text-slate-700',
        success: 'bg-green-100 text-green-800',
        warning: 'bg-amber-100 text-amber-800',
        error:   'bg-red-100 text-red-800',
        info:    'bg-blue-100 text-blue-800',
        purple:  'bg-purple-100 text-purple-800',
        outline: 'border border-gray-300 text-gray-700 bg-transparent',
        // Divisas
        usd:  'bg-green-100 text-green-800',
        cop:  'bg-amber-100 text-amber-800',
        ves:  'bg-purple-100 text-purple-800',
        usdt: 'bg-cyan-100 text-cyan-800',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
)

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  className?: string
}

export function Badge({ variant, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  )
}
